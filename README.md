# 🎶 Music Library Management System (MLMS)

This is a full-stack music library manager that allows authenticated admins to add, view, and manage artists, albums, and tracks. Built with React and Node.js.

---

## 🚀 Tech Stack

- **Frontend:** React (Create React App), Axios, React Router
- **Backend:** Node.js, Express, MySQL
- **Database:** MySQL (hosted on Aiven)
- **Auth:** JWT-based login system with role-based access (admin vs user)

---

## 🧑‍💻 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/mlms-project.git
cd mlms-project
```

### 2. Install Dependencies

#### Frontend
```bash
cd mlms-frontend
npm install
```

#### Backend
```bash
cd ../mlms-backend
npm install
```

### 3. Create Environment Config
In /mlms-backend/.env, add:
```env
DB_HOST=your-aiven-host.k.aivencloud.com
DB_PORT=your_port
DB_USER=your_user
DB_PASS=your_password
DB_NAME=your_db
JWT_SECRET=yourSuperSecretKey
```
Place your ca.pem file (Aiven certificate) in /mlms-backend.

### 4. Seed the Database (Test Data)
To clean duplicates and populate sample data (Kendrick Lamar, SZA, Outkast):
```bash
cd mlms-backend
node cleandb.js
```

### 5. Run the App

#### Backend

```bash
npm run dev
```

#### Frontend (in another terminal)

```bash
cd ../mlms-frontend
npm start
```
