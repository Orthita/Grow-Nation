# How to Run Grow Nation in VS Code

### Requirements
- Node.js
- MySQL Server
- Visual Studio Code

### Steps

**1. Clone the repository**

Open VS Code terminal:

```bash
git clone https://github.com/Orthita/Grow-Nation.git
cd Grow-Nation
```

**2. Install dependencies**

```bash
npm install
```

**3. Create environment file**

```bash
copy .env.example .env
```

Open `.env` and configure your MySQL username, password, and database settings.

**4. Initialize the database**

Make sure MySQL Server is running, then execute:

```bash
npm run init-db
```

**5. Start the project**

```bash
npm start
```

### Open in Browser

- Website: http://localhost:3000
- Admin Login: http://localhost:3000/admin/login.html

**To stop the server:** Press `Ctrl + C` in the terminal.
