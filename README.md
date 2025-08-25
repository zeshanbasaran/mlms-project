# 🎶 Music Library Management System (MLMS)

A full-stack music library manager that allows authenticated admins to add, view, and manage artists, albums, and tracks. Regular users can browse the library, like songs, and create playlists. Built with React, Node.js, and MySQL.

---

## 🚀 Features

- 🔐 Authentication – JWT-based login with role-based access (admin vs. regular user).
- 🎧 User Dashboard – See your liked songs, playlists, and recent activity.
- 📂 Library Management – Browse artists, albums, and songs.
- ❤️ Liked Songs – Save your favorite tracks.
- 🎶 Playlists – Create, edit, and manage personal playlists.
- 👤 Profile Management – Update password, change subscription plan.
- 🛠️ Admin Panel – Manage tracks, albums, and artists with inline editing, sorting, and deletion.

---

## 🚀 Tech Stack

- **Frontend:** React (Create React App), Axios, React Router
- **Backend:** Node.js, Express, MySQL
- **Database:** MySQL (hosted on Aiven)
- **Auth:** JWT-based login system with role-based access (admin vs user)

---

## 🖼️ Screenshots

### Login / Register

#### Login

<img width="3839" height="1697" alt="image" src="https://github.com/user-attachments/assets/9eb92547-cb97-47c1-9423-2cfc2b1561e2" />

#### Register

<img width="3839" height="1712" alt="image" src="https://github.com/user-attachments/assets/25603b45-d58f-4092-af60-d5185a1ecb05" />

### Admin

#### Dashboard

<img width="3839" height="1733" alt="image" src="https://github.com/user-attachments/assets/a580f68d-ddbe-4722-85c3-be9fc4a41577" />

#### Library Manager

<img width="3835" height="1697" alt="image" src="https://github.com/user-attachments/assets/c08d188b-1552-48bb-879e-8a1e9c4cf815" />

#### Create Playlist 

<img width="3839" height="1710" alt="image" src="https://github.com/user-attachments/assets/9cb56b7c-d64a-4abd-9641-27defbc8a79c" />

#### Preview Playlist

<img width="3839" height="1684" alt="image" src="https://github.com/user-attachments/assets/35f81990-0679-42f2-93a3-b53295b49ba0" />

#### Profile

<img width="3839" height="1687" alt="image" src="https://github.com/user-attachments/assets/60ab9012-ff47-4e58-a716-b35f97fd4d99" />

### Regular User

#### Dashboard

<img width="3839" height="1713" alt="image" src="https://github.com/user-attachments/assets/2221e6a6-eabc-486d-8a02-b62d6a333b93" />

#### Library

<img width="3839" height="1681" alt="image" src="https://github.com/user-attachments/assets/53a84aa4-bc99-4c1d-81f3-5fc867e45dc3" />

#### Playlists

<img width="3839" height="1696" alt="image" src="https://github.com/user-attachments/assets/984a60e9-8d08-47cc-a2d3-c31489115437" />

#### Liked Songs

<img width="3839" height="1681" alt="image" src="https://github.com/user-attachments/assets/048556e4-2d6b-4883-b8ab-a906f3da3b49" />

#### Profile

<img width="3839" height="1702" alt="image" src="https://github.com/user-attachments/assets/edc5fda8-949d-4138-9afb-769d5097158f" />

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
