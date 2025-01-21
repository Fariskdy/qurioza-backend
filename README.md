# Learning Management System API

A robust backend API for a Learning Management System built with Node.js, Express, and MongoDB.

## Features

- 🔐 Authentication & Authorization

  - JWT-based authentication
  - Role-based access control (Admin, Course Coordinator, Teacher, Student)
  - Token refresh mechanism

- 📚 Course Management

  - Course creation and management
  - Module organization
  - Category management
  - Batch scheduling

- 📝 Assignment System

  - Assignment creation
  - Submission handling
  - Grading system
  - Due date management

- 📊 Quiz System

  - Quiz creation
  - Auto-grading
  - Result tracking
  - Time-bound submissions

- 👥 User Management
  - Profile management
  - Role-based permissions
  - Teacher assignments
  - Student enrollments

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT for Authentication
- bcrypt for Password Hashing
- cors for Cross-Origin Resource Sharing

## ENVIROMENT VARIABLES

- PORT=
- MONGO_URI=
- JWT_SECRET=
- JWT_REFRESH_SECRET=
- CLIENT_URL=
