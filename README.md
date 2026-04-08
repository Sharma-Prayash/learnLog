# LearnLog 🔥 - Comprehensive Reference Architecture Documentation

**LearnLog** is a full-stack, decentralized classroom management and course progress tracking platform. This document serves as the **Master Guide**—tailored to provide developers, architects, and technical interviewers with a deep, transparent view into what was built, how the stack was implemented, the design patterns utilized, and the data structures underlying the system.

![Theme](https://img.shields.io/badge/Theme-Hybrid%20Light%2FDark-blue)
![Stack](https://img.shields.io/badge/Stack-React%20%7C%20Express%20%7C%20MySQL%20%7C%20AWS-orange)

---

## 🏗 1. Project Overview & Features implemented

LearnLog creates an interactive environment connecting **Educators (Admins/Teachers)** with **Learners (Students)** using an advanced hierarchical file-system approach.

### ✅ What we implemented:
- **Role-Based Access Control (RBAC):** Distinct workflows for Teachers vs. Students based on secure backend validations.
- **Hierarchical Node Engine:** Course content is organized in folders and files (similar to a local file explorer), with parent-child relationships rather than a flat list.
- **Granular Progress Tracking:** Students mark individual files/nodes as complete. Progress bars recalculate dynamically across the whole classroom based on fractional completion.
- **Multi-Tenant Gateway:** Users join multiple, isolated classrooms using unique 8-character invite codes generated upon classroom creation.
- **Membership Approval Flow:** When students attempt to join a class, they are put in a `pending` state until the Teacher approves or rejects them.
- **Direct Cloud Integration:** Native AWS S3 usage for secure file hosting along with Signed URL generators to ensure resources are not public.
- **Social & Collaboration Layers:** 
  - **Announcements:** Teachers can blast global classroom messages.
  - **Doubts System:** A global classroom Q&A board where students post issues, and members/teachers reply and mark them as *resolved*.
  - **Lesson Comments:** Granular, node-specific comment sections so questions stay contextualized to the specific learning material.
- **Dynamic Design System:** Custom vanilla CSS architecture mimicking 'Tailwind-like' utility behavior while preserving purely semantic custom variables. It effortlessly bridges Dark & Light themes with glassmorphism aesthetics.

---

## 🛠 2. Technology Stack & Packages

### 🖥️ Frontend (Client)
- **Framework:** React.js v19
- **Build Tool:** Vite (for modular hot-reloading and lightning-fast bundle delivery)
- **Routing:** `react-router-dom` v7 (Protected routes & layouts)
- **Styling:** Custom Vanilla CSS (`index.css` global design system). Zero bloated frameworks. Utilized deeply nested CSS custom properties for responsive theming.
- **Icons:** `lucide-react`
- **Network Flow:** `axios` with interceptors automatically handling `Authorization` headers.

### ⚙️ Backend (Server)
- **Runtime & Framework:** Node.js (v18+) with Express.js (v4.21).
- **Security & Auth:** `jsonwebtoken` (JWT) for stateless sessions, `bcryptjs` for zero-knowledge password hashing, `cors` for boundary enforcement.
- **File Parsing:** `multer` intercepting `multipart/form-data` uploads.
- **Database Driver:** `mysql2` utilizing connection pools.
- **Cloud Provider SDK:** `@aws-sdk/client-s3` & `@aws-sdk/s3-request-presigner` for temporary, time-bound URL streaming.

---

## 📂 3. Directory & Code Structure

The repository is built strictly decoupling the Client (React) from the API Gateway (Express).

```text
learnLog/
├── package.json               # Root monorepo workspace configurations
├── server/                    # 🟢 BACKEND MICRO-MONOLITH
│   ├── index.js               # API Server Entry Point. Registers middlewares & routers.
│   ├── .env                   # Secrets (DB Auth, AWS Keys, JWT Secret)
│   ├── db/
│   │   ├── connection.js      # MySQL2 Pool Setup. Auto-invokes schema building on boot.
│   │   └── schema.sql         # Raw SQL defining the relational tables & constraints.
│   ├── middleware/
│   │   └── auth.js            # Intercepts headers, verifies JWT payload, maps to `req.user`.
│   ├── services/              # Cloud providers (e.g., S3 interfacing functions).
│   └── routes/                # 🔗 API Route Controllers
│       ├── auth.js            # Sign up, Login, Token validation
│       ├── classrooms.js      # Classroom CRUD & Code logic
│       ├── memberships.js     # Student Join / Teacher Approve workflows
│       ├── nodes.js           # Core Hierarchy Graph (Parents, Children recursively)
│       ├── doubts.js          # Q&A management
│       └── upload.js          # Multer handlers
└── src/                       # 🔵 FRONTEND REACT APP
    ├── index.css              # Baseline Design System & CSS Variables (Dark/Light).
    ├── main.jsx               # Bootstrap.
    ├── App.jsx                # Router wrapping, AuthProvider initialization.
    ├── api/                   # Pre-configured Axios instance.
    ├── context/               # Global states: `AuthContext` (JWT) & `ThemeContext`.
    ├── pages/                 # Full screen layout components.
    │   ├── Login.jsx & Register.jsx
    │   ├── Dashboard.jsx      # High-level entry (Listing classrooms).
    │   ├── AdminWorkspace.jsx # Teacher's view: Gradebook, File Uploads, Approvals.
    │   └── StudentWorkspace.jsx # Student's view: Navigation Tree, Lesson Reading.
    └── components/            # Reusable UI Blocks (Modals, Panels, Video Players, FolderTrees).
```

---

## 🗄️ 4. Database Schema & Structure

We utilize a robust **Relational Database Model (MySQL)** ensuring cascade deletes and atomic consistency.

1. **`users`**
   - Stores `username`, `email`, and `password_hash`.
2. **`classrooms`**
   - **Fields**: `id`, `name`, `description`, `owner_id` (FK to user), `invite_code` (Unique 8-char constraint).
   - *Logic*: The epicenter. Deleting this cascades all related data.
3. **`memberships`**
   - **Fields**: `user_id`, `classroom_id`, `role` (teacher/student), `status` (pending/approved/rejected).
   - *Logic*: Manages the enrollment perimeter. 
4. **`nodes`**
   - **Fields**: `id`, `classroom_id`, `name`, `type` (folder/file), `parent_id` (Self-referencing FK to `nodes.id`), `resource_url`.
   - *Logic*: Enables deep infinitely nested folders. The root folder has a `parent_id` equal to `NULL`.
5. **`user_progress`**
   - **Fields**: `user_id`, `node_id`, `completed` (boolean).
   - *Logic*: Maps specifically *files* to *students*.
6. **`announcements`** (Belongs to classroom, written by user).
7. **`lesson_comments`** (Belongs to a specific node, written by user).
8. **`doubts` & `doubt_replies`**
   - Q&A thread system belonging to a classroom. `doubts` has an open/closed `status`.

---

## 📡 5. REST APIs: Structure, Usage & Endpoints

All APIs are prefixed with `/api`. Security is strictly enforced using the JWT `auth` middleware across all state-mutating and private read routes. 

### **Authentication (`/api/auth`)**
- `POST /register`: Accepts credentials, hashes via standard bcrypt, inserts to `users`, returns JWT.
- `POST /login`: Validates password hash against DB, dispatches serialized valid JWT containing `{ userId }`.
- `GET /verify`: Consumes a JWT token via headers to auto-hydrate page refreshes on the frontend `AuthContext`.

### **Classroom Lifecycle (`/api/classrooms`)**
- `GET /`: Returns classrooms the active user is associated with (either they own it or they have a membership).
- `POST /`: Teacher invokes this. The backend forcefully generates an 8 digit invite hash and returns it so students can join.
- `GET /:id/progress`: **Teacher Only.** Does complex JOIN logic combining the total number of files in the classroom geometry against what specific users have flagged `completed` in `user_progress`.

### **Membership Workflows (`/api/memberships`)**
- `POST /join`: Students invoke this with the invite code. Generates a DB record assigned `pending` status.
- `PATCH /:membershipId`: Teacher changes a pending invite to `approved` (or rejects it). A rejection prevents the user from viewing `/nodes`.

### **Hierarchical Nodes Core (`/api/nodes`)**
- `GET /classroom/:id`: Retrives all nodes for a room. The React frontend's `FolderTree.jsx` algorithm processes this flat relational list and recursively structures it into nested JavaScript Objects to render the visual filesystem tree.
- `DELETE /:id`: Backend cascades deletion utilizing MySQL `ON DELETE CASCADE`. If a parent directory is killed, all file children in the table are eradicated automatically natively at the SQL level.
- `POST /:nodeId/progress`: Upserts the `user_progress` table when a student clicks "Mark as Complete" on the React page.

### **Collaboration Layers (`/api/doubts`, `/api/comments`, `/api/announcements`)**
- Standard CRUD layers enforcing specific authorization. Example: Only the Teacher or the original Author can resolve a Doubt (`PUT /api/doubts/:id/resolve`).

### **Storage APIs (`/api/upload`)**
- `POST /folder`: Configured to accept an automated bulk directory drop from the frontend (using `<input type="file" webkitdirectory />`). Tracks internal pathing geometry and recreates those folders in `nodes` on-the-fly, while saving specific raw objects to S3.

---

## 🚀 6. Conclusion & Viewpoint Summary

**How we implemented the UX Flow:**
A newly registered user logs in and is presented a Dashboard (empty state).
1. They can instantly act as an Administrator by tapping **"Create Class"**. They become the Owner.
2. They share the code. Students click **"Join Class"**, enter the code.
3. The Admin hits their "Members" tab, approves the pending student payload. 
4. The Admin mounts files to the Classroom tree using standard drag & drops. The DB records nodes matching the tree.
5. The Student accesses the workspace. The UI leverages `StudentWorkspace.jsx` which queries `nodes` and constructs a live filesystem. As the student views the attached S3 presigned-URLs rendering inline videos/PDFs, they hit COMPLETE. 
6. `user_progress` recalculates and the top-right React Progress Bar fills dynamically.

This robust decoupling allows immediate scalable transitions to microservices if necessary and maintains a purely RESTful, resilient developer structure.
