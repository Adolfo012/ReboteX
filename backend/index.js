// index.js - Servidor principal de ReboteX Backend
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.js";
import torneosRoutes from "./routes/torneos.js";
import { testConnection } from "./db.js";

// Cargar variables de entorno
dotenv.config();

const app = express();

// Middleware básico
app.use(express.json());
app.use(cors());

// Middleware de logging ANTES de las rutas
app.use((req, res, next) => {
  console.log(`🌐 ${req.method} ${req.url} - ${new Date().toISOString()}`);
  if (req.method === 'POST' && req.url.includes('/login')) {
    console.log("📧 Body del login:", req.body);
  }
  next();
});

// Rutas de autenticación
console.log("🔧 Registrando rutas de autenticación...");
app.use("/api/auth", authRoutes);
console.log("✅ Rutas de autenticación registradas en /api/auth");

// Rutas de torneos
console.log("🔧 Registrando rutas de torneos...");
app.use("/api/torneos", torneosRoutes);
console.log("✅ Rutas de torneos registradas en /api/torneos");

// Ruta de salud del servidor
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    message: "ReboteX Backend funcionando correctamente",
    timestamp: new Date().toISOString()
  });
});

// Ruta por defecto
app.get("/", (req, res) => {
  res.json({ 
    message: "Bienvenido a ReboteX Backend API",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      torneos: "/api/torneos",
      health: "/health"
    }
  });
});

const PORT = process.env.PORT || 3000;

// Agregar manejo de errores
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// Iniciar servidor
const startServer = async () => {
  try {
    // Probar conexión a la base de datos
    console.log("🔍 Probando conexión a la base de datos...");
    await testConnection();
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor ReboteX corriendo en http://localhost:${PORT}`);
      console.log('✅ Servidor iniciado correctamente');
      console.log(`📊 Endpoints disponibles:`);
      console.log(`   - GET  /              - Información del API`);
      console.log(`   - GET  /health        - Estado del servidor`);
      console.log(`   - POST /api/auth/register - Registro de usuarios`);
      console.log(`   - POST /api/auth/login    - Inicio de sesión`);
      console.log(`   - POST /api/torneos/create - Crear torneo`);
      console.log(`   - GET  /api/torneos/user/:id - Torneos de usuario`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error);
    process.exit(1);
  }
};

// Mantener el proceso vivo
setInterval(() => {
  // No hacer nada, solo mantener el proceso activo
}, 1000);

// Iniciar el servidor
startServer();