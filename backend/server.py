from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr, BeforeValidator
from typing import List, Optional, Annotated, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
from bson import ObjectId

# --- CONFIG & SETUP ---
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL')
if not mongo_url:
    mongo_url = "mongodb://localhost:27017" # Fallback for local dev if env missing

client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'timesheet_db')]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# CORS
origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"], # Allow all for dev simplicity, restrict in prod
    allow_methods=["*"],
    allow_headers=["*"],
)

# Auth Config
SECRET_KEY = os.environ.get("SECRET_KEY", "supersecretkey") # CHANGE IN PROD
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # 1 day

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- MODELS ---

# Helper for ObjectId
PyObjectId = Annotated[str, BeforeValidator(str)]

class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = "Employee" # Employee, Manager, Admin
    reports_to: Optional[str] = None # Manager ID

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: Optional[str] = Field(alias="_id", default=None)
    model_config = ConfigDict(populate_by_name=True)

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class SubProject(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: str

class Project(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    code: str
    sub_projects: List[SubProject] = []
    model_config = ConfigDict(populate_by_name=True)

class DailyEntry(BaseModel):
    day_index: int # 0=Mon, 6=Sun
    hours: float
    notes: Optional[str] = ""

class TimesheetRow(BaseModel):
    project_id: str
    sub_project_id: str
    entries: List[DailyEntry] # Should have 7 entries
    location: Optional[str] = "Remote" # Location/Country

class Timesheet(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    user_id: str
    week_start_date: str # ISO Date YYYY-MM-DD (Monday)
    rows: List[TimesheetRow] = []
    status: str = "Draft" # Draft, Submitted, Approved, Rejected
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejected_at: Optional[datetime] = None
    audit_trail: List[Dict[str, Any]] = [] # {action, user, timestamp}
    total_hours: float = 0.0
    
    model_config = ConfigDict(populate_by_name=True)

class Country(BaseModel):
    id: Optional[str] = Field(alias="_id", default=None)
    name: str
    code: str
    holidays: List[str] = [] # List of YYYY-MM-DD strings

# --- AUTH UTILS ---

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(lambda x: x if isinstance(x, str) else None)):
    # In a real app, use OAuth2PasswordBearer
    # Here we simulate extracting from header in endpoints for simplicity or passed via dependency
    pass

from fastapi.security import OAuth2PasswordBearer
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await db.users.find_one({"email": email})
    if user is None:
        raise credentials_exception
    
    # Return User object
    user['id'] = str(user['_id'])
    del user['_id'] # safe removal
    if 'password' in user: del user['password']
    return User(**user)

# --- ROUTES ---

@api_router.get("/")
async def root():
    return {"message": "Timesheet API Running"}

# AUTH
@api_router.post("/auth/login")
async def login(form_data: dict = Body(...)):
    email = form_data.get("email")
    password = form_data.get("password")
    
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(password, user['password']):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Fix ID for response
    user_id = str(user['_id'])
    # Create user response manually to avoid alias issues
    user_resp = {
        "id": user_id,
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "reports_to": user.get("reports_to")
    }
    
    access_token = create_access_token(data={"sub": user['email'], "role": user['role'], "id": user_id})
    return {"access_token": access_token, "token_type": "bearer", "user": user_resp}

@api_router.post("/auth/register")
async def register(user: UserCreate):
    existing = await db.users.find_one({"email": user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user.model_dump()
    user_dict['password'] = get_password_hash(user.password)
    
    new_user = await db.users.insert_one(user_dict)
    return {"id": str(new_user.inserted_id), "email": user.email}

@api_router.get("/auth/me", response_model=User)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# USERS (Admin only - simplified)
@api_router.get("/users", response_model=List[User])
async def get_users(current_user: User = Depends(get_current_user)):
    # In real app, check if admin
    users = await db.users.find().to_list(1000)
    results = []
    for u in users:
        u['id'] = str(u['_id'])
        if 'password' in u: del u['password']
        results.append(User(**u))
    return results

# PROJECTS
@api_router.get("/projects", response_model=List[Project])
async def get_projects(current_user: User = Depends(get_current_user)):
    projects = await db.projects.find().to_list(100)
    results = []
    for p in projects:
        p['id'] = str(p['_id'])
        del p['_id']  # Remove the ObjectId field
        results.append(Project(**p))
    return results

@api_router.post("/projects")
async def create_project(project: Project, current_user: User = Depends(get_current_user)):
    if current_user.role not in ['Admin', 'Manager']:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Create dict without id field
    p_dict = {
        "name": project.name,
        "code": project.code,
        "sub_projects": [sp.model_dump() for sp in project.sub_projects]
    }
    new_p = await db.projects.insert_one(p_dict)
    
    # Return response dict manually
    return {
        "id": str(new_p.inserted_id),
        "name": p_dict["name"],
        "code": p_dict["code"],
        "sub_projects": p_dict["sub_projects"]
    }

# TIMESHEETS
@api_router.get("/timesheets/week", response_model=Optional[Timesheet])
async def get_timesheet_by_week(week_start: str, user_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    target_user_id = user_id if user_id else current_user.id
    
    # Access Control
    if target_user_id != current_user.id and current_user.role == 'Employee':
        raise HTTPException(status_code=403, detail="Cannot view other users' timesheets")
        
    ts = await db.timesheets.find_one({"user_id": target_user_id, "week_start_date": week_start})
    
    if ts:
        ts['id'] = str(ts['_id'])
        del ts['_id']  # Remove the ObjectId field
        return Timesheet(**ts)
    return None

@api_router.post("/timesheets", response_model=Timesheet)
async def save_timesheet(timesheet: Timesheet, current_user: User = Depends(get_current_user)):
    # Logic: Upsert
    # Check if locked
    existing = await db.timesheets.find_one({
        "user_id": timesheet.user_id, 
        "week_start_date": timesheet.week_start_date
    })
    
    if existing and existing.get('status') in ['Submitted', 'Approved'] and current_user.role == 'Employee':
         raise HTTPException(status_code=400, detail="Timesheet is locked")

    ts_dict = timesheet.model_dump(exclude={"id"})
    
    # Calculate total
    total = 0
    for row in ts_dict['rows']:
        for entry in row['entries']:
            total += entry['hours']
    ts_dict['total_hours'] = total
    
    # Audit
    action = "Created" if not existing else "Updated"
    audit_entry = {
        "action": action,
        "user": current_user.email,
        "timestamp": datetime.now(timezone.utc)
    }
    
    if existing:
        ts_dict['audit_trail'] = existing.get('audit_trail', []) + [audit_entry]
        # Preserve status unless explicitly changing via specific endpoint? 
        # For now, saving implies keeping current status or Draft if new.
        if existing['status'] == 'Rejected':
             ts_dict['status'] = 'Draft' # Reset to draft on edit after rejection
        else:
             ts_dict['status'] = existing['status']
             
        await db.timesheets.update_one(
            {"_id": existing['_id']},
            {"$set": ts_dict}
        )
        return Timesheet(id=str(existing['_id']), **ts_dict)
    else:
        ts_dict['audit_trail'] = [audit_entry]
        ts_dict['status'] = "Draft"
        new_ts = await db.timesheets.insert_one(ts_dict)
        return Timesheet(id=str(new_ts.inserted_id), **ts_dict)

@api_router.post("/timesheets/{ts_id}/submit")
async def submit_timesheet(ts_id: str, current_user: User = Depends(get_current_user)):
    ts = await db.timesheets.find_one({"_id": ObjectId(ts_id)})
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")
        
    if ts['total_hours'] < 40:
        # Just a warning in UI, backend allows it but logs it?
        pass 
        
    audit_entry = {
        "action": "Submitted",
        "user": current_user.email,
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.timesheets.update_one(
        {"_id": ObjectId(ts_id)},
        {"$set": {
            "status": "Submitted",
            "submitted_at": datetime.now(timezone.utc),
            "audit_trail": ts.get('audit_trail', []) + [audit_entry]
        }}
    )
    return {"status": "success"}

@api_router.post("/timesheets/{ts_id}/approve")
async def approve_timesheet(ts_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role == 'Employee':
        raise HTTPException(status_code=403, detail="Not authorized")
        
    ts = await db.timesheets.find_one({"_id": ObjectId(ts_id)})
    if not ts:
        raise HTTPException(status_code=404, detail="Timesheet not found")
        
    audit_entry = {
        "action": "Approved",
        "user": current_user.email,
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.timesheets.update_one(
        {"_id": ObjectId(ts_id)},
        {"$set": {
            "status": "Approved",
            "approved_at": datetime.now(timezone.utc),
            "approved_by": current_user.id,
            "audit_trail": ts.get('audit_trail', []) + [audit_entry]
        }}
    )
    return {"status": "success"}

@api_router.post("/timesheets/{ts_id}/reject")
async def reject_timesheet(ts_id: str, current_user: User = Depends(get_current_user)):
    if current_user.role == 'Employee':
        raise HTTPException(status_code=403, detail="Not authorized")
        
    ts = await db.timesheets.find_one({"_id": ObjectId(ts_id)})
    
    audit_entry = {
        "action": "Rejected",
        "user": current_user.email,
        "timestamp": datetime.now(timezone.utc)
    }
    
    await db.timesheets.update_one(
        {"_id": ObjectId(ts_id)},
        {"$set": {
            "status": "Rejected",
            "rejected_at": datetime.now(timezone.utc),
            "audit_trail": ts.get('audit_trail', []) + [audit_entry]
        }}
    )
    return {"status": "success"}

# SEEDING (Run on startup)
async def seed_db():
    # Check if admin exists
    admin = await db.users.find_one({"email": "admin@example.com"})
    if not admin:
        admin_user = UserCreate(
            email="admin@example.com",
            full_name="System Admin",
            password="admin",
            role="Admin"
        )
        # Manually insert to reuse register logic hash
        admin_dict = admin_user.model_dump()
        admin_dict['password'] = get_password_hash(admin_user.password)
        await db.users.insert_one(admin_dict)
        print("Seeded Admin User")

    # Check projects
    count = await db.projects.count_documents({})
    if count == 0:
        projects = [
            Project(name="Internal", code="INT-001", sub_projects=[
                SubProject(name="Administrative", code="ADM"),
                SubProject(name="Training", code="TRN"),
                SubProject(name="Meetings", code="MTG")
            ]),
            Project(name="Client Alpha", code="CL-A", sub_projects=[
                SubProject(name="Development", code="DEV"),
                SubProject(name="Design", code="DES"),
                SubProject(name="Testing", code="TST")
            ]),
             Project(name="Time Off", code="TO", sub_projects=[
                SubProject(name="Vacation", code="VAC"),
                SubProject(name="Sick Leave", code="SICK"),
                SubProject(name="Public Holiday", code="PUB")
            ])
        ]
        for p in projects:
            p_dict = p.model_dump(by_alias=True, exclude={"id"})
            await db.projects.insert_one(p_dict)
        print("Seeded Projects")

@app.on_event("startup")
async def startup_event():
    await seed_db()

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

app.include_router(api_router)
