import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';
import { exec } from 'child_process';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Initialiser Prisma
const prisma = new PrismaClient();

// Gestion des erreurs non capturées
process.on('uncaughtException', (err) => {
  console.error('❌ Erreur non capturée:', err.message);
  console.error('Stack:', err.stack);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesse rejetée:', reason);
});

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET || 'Pr0m3tt@-2025-S3cur3-JWT-K3y-' + crypto.randomBytes(16).toString('hex');
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const SIGNUP_ENABLED = process.env.SIGNUP_ENABLED !== 'false';
const MAX_ADMINS = parseInt(process.env.MAX_ADMINS) || 3;

// ✅ Configuration multer pour les screenshots
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    cb(null, `screenshot_${timestamp}${ext}`);
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Seules les images sont autorisées'), false);
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'brutui/valide')));

// ✅ Servir les fichiers uploadés
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Middleware d'authentification JWT (pour plus tard)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
  
  if (!token) {
    return res.status(401).json({ message: 'Token d\'accès requis' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.log('❌ Token invalide:', err.message);
      return res.status(403).json({ message: 'Token invalide ou expiré' });
    }
    
    req.user = user;
    next();
  });
};

// ✅ Nouvelle route d'inscription avec validation complète et compatible
app.post('/api/register', async (req, res) => {
  try {
    if (!SIGNUP_ENABLED) {
      return res.status(403).json({ message: 'Inscription temporairement désactivée' });
    }
    
    const { email, username, password } = req.body;
    
    console.log('🔍 Données inscription reçues:', { email, username, password: '***' });
    
    // Validation des données requises (comme avant)
    if (!email || !username || !password) {
      return res.status(400).json({ message: 'Tous les champs sont requis' });
    }
    
    // Validation des types (nouveau - compatible)
    if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Format de données invalide' });
    }
    
    // Validation longueur password (comme avant)
    if (password.length < 6) {
      return res.status(400).json({ message: 'Le mot de passe doit contenir au moins 6 caractères' });
    }
    
    // Validation longueur password max (nouveau - raisonnable)
    if (password.length > 200) {
      return res.status(400).json({ message: 'Mot de passe trop long (max 200 caractères)' });
    }
    
    // Validation email format (comme avant)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }
    
    // Validation email longueur (nouveau - raisonnable)
    if (email.length > 150) {
      return res.status(400).json({ message: 'Email trop long (max 150 caractères)' });
    }
    
    // Validation username longueur (nouveau - permissif)
    if (username.length < 1 || username.length > 80) {
      return res.status(400).json({ message: 'Nom d\'utilisateur invalide (1-80 caractères)' });
    }
    
    // Validation username caractères (nouveau - permissif)
    const usernameRegex = /^[a-zA-Z0-9_.-]+$/; // Autorise . et -
    if (!usernameRegex.test(username)) {
      return res.status(400).json({ message: 'Nom d\'utilisateur invalide (lettres, chiffres, _, . et - uniquement)' });
    }
    
    // Sanitisation des données (nouveau)
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedUsername = username.trim().replace(/[<>]/g, '');
    
    // Vérifier le nombre d'utilisateurs existants (comme avant)
    const userCount = await prisma.user.count();
    if (userCount >= MAX_ADMINS) {
      return res.status(400).json({ 
        message: `Limite d'administrateurs atteinte (${MAX_ADMINS} max)` 
      });
    }
    
    // Vérifier si l'email existe déjà (comme avant)
    const existingUser = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });
    
    if (existingUser) {
      return res.status(400).json({ message: 'Un utilisateur avec cet email existe déjà' });
    }
    
    // Hacher le mot de passe (comme avant)
    console.log('🔒 Hachage du mot de passe...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Créer l'utilisateur avec données sanitisées
    const user = await prisma.user.create({
      data: {
        email: sanitizedEmail,
        username: sanitizedUsername,
        password: hashedPassword
      }
    });
    
    // Générer un token JWT (comme avant)
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log('✅ Utilisateur créé avec succès:', user.email);
    
    res.json({
      message: 'Compte créé avec succès',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.username
      },
      redirect_url: 'dashboard.html'
    });
  } catch (error) {
    console.error('❌ Erreur inscription:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});


// ✅ Route de connexion avec validation complète et compatible
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('🔍 Données connexion reçues:', { email, password: '***' });
    
    // Validation des données requises (comme avant)
    if (!email || !password) {
      return res.status(400).json({ message: 'Email et mot de passe requis' });
    }
    
    // Validation des types (nouveau - compatible)
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ message: 'Format de données invalide' });
    }
    
    // Validation longueur email (nouveau - raisonnable)
    if (email.length > 150) {
      return res.status(400).json({ message: 'Email trop long (max 150 caractères)' });
    }
    
    // Validation longueur password (nouveau - raisonnable)
    if (password.length > 200) {
      return res.status(400).json({ message: 'Mot de passe trop long (max 200 caractères)' });
    }
    
    // Validation format email (nouveau - compatible)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({ message: 'Format d\'email invalide' });
    }
    
    // Sanitisation des données (nouveau)
    const sanitizedEmail = email.trim().toLowerCase();
    
    // Chercher l'utilisateur en base avec email sanitisé
    const user = await prisma.user.findUnique({
      where: { email: sanitizedEmail }
    });
    
    if (!user) {
      console.log('❌ Tentative de connexion - Email non trouvé:', sanitizedEmail);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    let isValidPassword = false;
    
    // Vérifier si le mot de passe est haché (commence par $2b$)
    if (user.password.startsWith('$2b$')) {
      // Nouveau format : mot de passe haché
      console.log('🔐 Vérification mot de passe haché pour:', sanitizedEmail);
      isValidPassword = await bcrypt.compare(password, user.password);
    } else {
      // Ancien format : mot de passe en clair
      console.log('🔓 Vérification mot de passe en clair pour:', sanitizedEmail);
      isValidPassword = (user.password === password);
      
      // Migration automatique : hasher le mot de passe maintenant
      if (isValidPassword) {
        console.log('🔄 Migration automatique du mot de passe pour:', sanitizedEmail);
        const hashedPassword = await bcrypt.hash(password, 12);
        await prisma.user.update({
          where: { id: user.id },
          data: { password: hashedPassword }
        });
        console.log('✅ Mot de passe migré avec succès');
      }
    }
    
    if (!isValidPassword) {
      console.log('❌ Tentative de connexion - Mot de passe incorrect pour:', sanitizedEmail);
      return res.status(401).json({ message: 'Email ou mot de passe incorrect' });
    }
    
    // Générer un token JWT (comme avant)
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        username: user.username 
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
    
    console.log('✅ Connexion réussie avec JWT pour:', sanitizedEmail);
    
    res.json({
      message: 'Connexion réussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.username
      },
      redirect_url: 'dashboard.html'
    });
  } catch (error) {
    console.error('❌ Erreur connexion:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Route pour créer un client
app.post('/api/clients', authenticateToken, async (req, res) => {
  try {
    const { name, website, userId } = req.body;
    
    console.log('🔍 Données reçues:', { name, website, userId });
    
    // Validation des données requises
    if (!name || !userId) {
      return res.status(400).json({ message: 'Nom du client et userId sont requis' });
    }
    
    // Validation du nom
    const trimmedName = name.trim();
    console.log('🔍 Debug nom:', { 
      name: name, 
      trimmedName: trimmedName, 
      length: trimmedName.length,
      isString: typeof name === 'string',
      isTooShort: trimmedName.length < 2,
      isTooLong: trimmedName.length > 100
    });

    if (typeof name !== 'string' || trimmedName.length < 2 || trimmedName.length > 100) {
      console.log('❌ Validation nom échouée');
      return res.status(400).json({ message: 'Nom invalide (2-100 caractères)' });
    }
    
    // Validation du userId - Plus stricte
    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      return res.status(400).json({ message: 'UserId invalide' });
    }
    
    // Validation du website (optionnel) - Avec debug
    if (website && website.trim() !== '') {
      console.log('🔍 Debug website:', { 
        website: website, 
        trimmed: website.trim(),
        length: website.length,
        urlRegexTest: /^https?:\/\/.+\..+/.test(website.trim())
      });
      
      if (typeof website !== 'string' || website.length > 255) {
        console.log('❌ Validation website - trop long');
        return res.status(400).json({ message: 'Website invalide (max 255 caractères)' });
      }
      
      // Validation format URL - Plus stricte
      const urlRegex = /^https?:\/\/.+\..+/;
      if (!urlRegex.test(website.trim())) {
        console.log('❌ Validation URL - format invalide');
        return res.status(400).json({ message: 'Format d\'URL invalide (doit commencer par http:// ou https://)' });
      }
    }
    
    // Sanitisation des données
    const sanitizedName = name.trim().replace(/[<>]/g, '');
    const sanitizedWebsite = (website && website.trim() !== '') ? website.trim() : null;
    
    // Vérifier que l'utilisateur existe
    const user = await prisma.user.findUnique({
      where: { id: userIdNum }
    });
    
    if (!user) {
      return res.status(400).json({ message: 'Utilisateur non trouvé' });
    }
    
    // Créer le client avec userId correct
    const client = await prisma.client.create({
      data: { 
        name: sanitizedName, 
        website: sanitizedWebsite,
        userId: userIdNum // ← Utilise le nombre parsé
      }
    });
    
    console.log('✅ Client créé avec succès:', client.name);
    
    res.json({ 
      message: 'Client créé avec succès',
      client: { 
        id: client.id, 
        name: client.name, 
        website: client.website 
      }
    });
  } catch (error) {
    console.error('❌ Erreur création client:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Route pour créer un projet avec validation complète
app.post('/api/projects', authenticateToken, async (req, res) => {
  try {
    const { name, url, clientId } = req.body;
    
    // Validation des données requises
    if (!name || !url || !clientId) {
      return res.status(400).json({ message: 'Nom, URL et clientId sont requis' });
    }
    
    // Validation du nom
    if (typeof name !== 'string' || name.length < 2 || name.length > 100) {
      return res.status(400).json({ message: 'Nom invalide (2-100 caractères)' });
    }
    
    // Validation de l'URL
    if (typeof url !== 'string' || url.length > 255) {
      return res.status(400).json({ message: 'URL invalide (max 255 caractères)' });
    }
    
    // Validation format URL
    const urlRegex = /^https?:\/\/.+/;
    if (!urlRegex.test(url)) {
      return res.status(400).json({ message: 'Format d\'URL invalide (doit commencer par http:// ou https://)' });
    }
    
    // Validation du clientId
    if (!Number.isInteger(parseInt(clientId)) || parseInt(clientId) <= 0) {
      return res.status(400).json({ message: 'ClientId invalide' });
    }
    
    // Sanitisation des données
    const sanitizedName = name.trim().replace(/[<>]/g, '');
    const sanitizedUrl = url.trim();
    
    // Vérifier que le client existe
    const client = await prisma.client.findUnique({
      where: { id: parseInt(clientId) }
    });
    
    if (!client) {
      return res.status(400).json({ message: 'Client non trouvé' });
    }
    
    // Créer le projet
    const project = await prisma.project.create({
      data: { 
        name: sanitizedName, 
        url: sanitizedUrl,
        status: 'pending',
        clientId: parseInt(clientId)
      }
    });
    
    console.log('✅ Projet créé avec succès:', project.name);
    
    res.json({ 
      message: 'Projet créé avec succès',
      project: { 
        id: project.id, 
        name: project.name, 
        url: project.url, 
        status: project.status 
      }
    });
  } catch (error) {
    console.error('❌ Erreur création projet:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Route pour récupérer les clients d'un utilisateur
app.get('/api/users/:userId/clients', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Validation du userId
    const userIdNum = parseInt(userId);
    if (isNaN(userIdNum) || userIdNum <= 0) {
      return res.status(400).json({ message: 'UserId invalide' });
    }
    
    const clients = await prisma.client.findMany({
      where: { userId: userIdNum },
      orderBy: { createdAt: 'desc' },
      include: {
        projects: {
          include: {
            audits: { 
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                url: true,
                score: true,
                createdAt: true,
                accessToken: true,  // ← IMPORTANT : Inclure le token !
                screenshotPath: true
              }
            }
          }
        }
      }
    });
    
    res.json({ message: 'Clients récupérés avec succès', clients });
  } catch (error) {
    console.error('❌ Erreur récupération clients:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Route pour récupérer les projets d'un client
app.get('/api/projects/:clientId', authenticateToken, async (req, res) => {
  try {
    const { clientId } = req.params;
    
    if (!clientId) {
      return res.status(400).json({ message: 'ClientId requis' });
    }
    
    // Récupérer tous les projets du client
    const projects = await prisma.project.findMany({
      where: { clientId: parseInt(clientId) },
      orderBy: { createdAt: 'desc' },
      include: {
        audits: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    
    res.json({ 
      message: 'Projets récupérés avec succès',
      projects: projects
    });
  } catch (error) {
    console.error('Erreur récupération projets:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Route pour créer un audit
app.post('/api/audits', authenticateToken, async (req, res) => {
  try {
    const { projectId, results, score, screenshotPath } = req.body;
    
    console.log('🔍 Données audit reçues:', { projectId, results, score, screenshotPath });
    
    // Validation des données requises
    if (!projectId) {
      return res.status(400).json({ message: 'ProjectId requis' });
    }
    
    // Validation projectId avec conversion automatique
    const projectIdNum = parseInt(projectId);
    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      return res.status(400).json({ message: 'ProjectId invalide' });
    }
    
    // Validation score avec conversion vers STRING (pour compatibilité DB)
    let scoreStr = null;
    if (score !== null && score !== undefined && score !== '') {
      const scoreNum = parseFloat(score);
      if (isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100) {
        return res.status(400).json({ message: 'Score invalide (0-100)' });
      }
      scoreStr = scoreNum.toString(); // ← Convertir en string pour la DB
    }
    
    // Validation results avec parsing automatique (optionnel)
    let resultsObj = null;
    if (results !== null && results !== undefined && results !== '') {
      if (typeof results === 'string') {
        try {
          resultsObj = JSON.parse(results);
        } catch (e) {
          return res.status(400).json({ message: 'Résultats invalides (JSON malformé)' });
        }
      } else if (typeof results === 'object' && !Array.isArray(results)) {
        resultsObj = results;
      } else {
        return res.status(400).json({ message: 'Résultats invalides (doit être un objet)' });
      }
    }
    
    // Validation screenshotPath (optionnel)
    if (screenshotPath && (typeof screenshotPath !== 'string' || screenshotPath.length > 500)) {
      return res.status(400).json({ message: 'Chemin screenshot invalide (max 500 caractères)' });
    }
    
    // Vérifier que le projet existe
    const project = await prisma.project.findUnique({
      where: { id: projectIdNum }
    });
    
    if (!project) {
      return res.status(400).json({ message: 'Projet non trouvé' });
    }
    
    // Créer l'audit avec score en string
    const audit = await prisma.audit.create({
      data: { 
        projectId: projectIdNum,
        results: resultsObj,
        score: scoreStr, // ← String au lieu de Number
        screenshotPath: screenshotPath || null
      }
    });
    
    console.log('✅ Audit créé avec succès:', {
      id: audit.id,
      url: audit.url,
      score: audit.score,
      hasResults: audit.results ? 'Oui' : 'Non',
      resultsSize: audit.results ? JSON.stringify(audit.results).length : 0
    });
    
    res.json({ 
      message: 'Audit créé avec succès',
      audit: { 
        id: audit.id, 
        projectId: audit.projectId,
        score: audit.score,
        screenshotPath: audit.screenshotPath,
        createdAt: audit.createdAt
      }
    });
  } catch (error) {
    console.error('❌ Erreur création audit:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Route pour récupérer les audits d'un projet
app.get('/api/audits/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;
    
    if (!projectId) {
      return res.status(400).json({ message: 'ProjectId requis' });
    }
    
    // Récupérer tous les audits du projet
    const audits = await prisma.audit.findMany({
      where: { projectId: parseInt(projectId) },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        score: true,
        createdAt: true,
        projectId: true,
        accessToken: true,
        screenshotPath: true,
        // ← Exclure 'results' pour éviter l'affichage des images base64
        project: {
          include: {
            client: true
          }
        }
      }
    });
    
    res.json({ 
      message: 'Audits récupérés avec succès',
      audits: audits
    });
  } catch (error) {
    console.error('Erreur récupération projets:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route pour récupérer les stats d'audit
app.get('/api/stats', authenticateToken, (req, res) => {
  // Version simplifiée sans lecture de fichier
  res.json({
    audits: 5,
    pages: 12,
    recos: 8,
    score: '87%'
  });
});

// Route pour servir le frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'brutui/valide/index.html'));
});

// ✅ Route pour uploader un screenshot
app.post('/api/upload-screenshot', upload.single('screenshot'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }
    
    const screenshotPath = `/uploads/${req.file.filename}`;
    
    res.json({ 
      message: 'Screenshot uploadé avec succès',
      screenshotPath: screenshotPath,
      filename: req.file.filename,
      size: req.file.size
    });
  } catch (error) {
    console.error('Erreur upload screenshot:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// ✅ Garder cette route mais la corriger
app.post('/api/launch-audit', authenticateToken, async (req, res) => {
  try {
    const { projectId, url } = req.body;
    
    console.log('🚀 Reçu demande d\'audit:', { projectId, url });
    
    // Validation des données requises
    if (!projectId || !url) {
      return res.status(400).json({ message: 'projectId et url requis' });
    }
    
    // Validation du projectId avec conversion automatique (compatible string)
    const projectIdNum = parseInt(projectId);
    if (isNaN(projectIdNum) || projectIdNum <= 0) {
      return res.status(400).json({ message: 'ProjectId invalide' });
    }
    
    // Validation de l'URL - Plus permissive
    if (typeof url !== 'string' || url.trim().length === 0) {
      return res.status(400).json({ message: 'URL requise' });
    }
    
    if (url.length > 500) {
      return res.status(400).json({ message: 'URL trop longue (max 500 caractères)' });
    }
    
    // Validation format URL - Plus souple
    const urlRegex = /^https?:\/\/.+/;
    if (!urlRegex.test(url.trim())) {
      return res.status(400).json({ message: 'Format d\'URL invalide (doit commencer par http:// ou https://)' });
    }
    
    // Sanitisation de l'URL pour éviter les injections
    const sanitizedUrl = url.trim().replace(/['"`;]/g, ''); // Supprimer les caractères dangereux
    
    // Vérifier que le projet existe
    const project = await prisma.project.findUnique({
      where: { id: projectIdNum },
      include: {
        client: true
      }
    });
    
    if (!project) {
      return res.status(400).json({ message: 'Projet non trouvé' });
    }
    
    // Générer le token d'accès
    const accessToken = crypto.randomBytes(32).toString('hex');
    
    // Créer l'audit avec le token
    const audit = await prisma.audit.create({
      data: {
        url: sanitizedUrl,
        projectId: projectIdNum,
        accessToken: accessToken,
        score: null,
        results: null
      },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    });
    
    console.log('✅ Audit créé avec token:', accessToken);
    
    // Lancer l'audit en arrière-plan avec échappement sécurisé
    const escapedUrl = sanitizedUrl.replace(/"/g, '\\"'); // Échapper les guillemets
    exec(`node audit_pipeline.js "${escapedUrl}" ${audit.id}`, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Erreur pipeline:', error);
      } else {
        console.log('✅ Pipeline lancé:', stdout);
      }
    });
    
    // Générer l'URL du rapport client
    const clientReportUrl = `${req.protocol}://${req.get('host')}/brutui/valide/rapport_client.html?token=${accessToken}`;
    
    console.log('🔗 URL rapport client:', clientReportUrl);
    
    res.json({
      message: 'Audit lancé avec succès',
      audit: {
        id: audit.id,
        url: audit.url,
        project: audit.project.name,
        client: audit.project.client.name,
        accessToken: accessToken,
        clientReportUrl: clientReportUrl
      }
    });
  } catch (error) {
    console.error('❌ Erreur lancement audit:', error);
    res.status(500).json({ message: 'Erreur lors du lancement de l\'audit' });
  }
});

// ✅ Remplacer cette route
app.get('/api/clients', authenticateToken, async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      where: { userId: req.user.userId }, // ← Seulement les clients de l'utilisateur
      include: {
        projects: {
          include: {
            audits: {
              orderBy: { createdAt: 'desc' },
              select: {
                id: true,
                url: true,
                score: true,
                createdAt: true,
                accessToken: true,  // ← IMPORTANT : Inclure le token !
                screenshotPath: true
              }
            }
          }
        }
      }
    });
    res.json({ clients });
  } catch (err) {
    console.error('❌ Erreur récupération clients:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération des clients' });
  }
});

// Nouvelle route pour récupérer un client par ID
app.get('/api/clients/:id', authenticateToken, async (req, res) => {
  try {
    const clientId = Number(req.params.id);
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        projects: {
          include: {
            audits: {
              orderBy: { createdAt: 'desc' } // ← Ajoute cette ligne pour trier par date décroissante
            }
          }
        }
      }
    });
    
    if (!client) {
      return res.status(404).json({ message: 'Client non trouvé' });
    }
    
    res.json({ clients: [client] });
  } catch (err) {
    res.status(500).json({ message: 'Erreur lors de la récupération du client' });
  }
});

// Route pour récupérer un audit par token (accès client - PAS de middleware d'auth)
app.get('/api/report/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Chercher l'audit par token
    const audit = await prisma.audit.findUnique({
      where: { accessToken: token },
      include: {
        project: {
          include: {
            client: true
          }
        }
      }
    });
    
    if (!audit) {
      return res.status(404).json({ message: 'Rapport non trouvé ou lien expiré' });
    }
    
    res.json({
      audit: {
        id: audit.id,
        url: audit.url,
        score: audit.score,
        results: audit.results,
        createdAt: audit.createdAt,
        project: {
          name: audit.project.name,
          client: {
            name: audit.project.client.name
          }
        }
      }
    });
  } catch (error) {
    console.error('Erreur récupération rapport:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// Route de debug pour vérifier les fichiers
app.get('/debug-files', (req, res) => {
  const staticPath = path.join(__dirname, 'brutui/valide');
  const rapportPath = path.join(staticPath, 'rapport_client.html');
  
  console.log('Debug paths:', {
    __dirname,
    staticPath,
    rapportPath
  });
  
  res.json({
    currentDir: __dirname,
    staticPath: staticPath,
    rapportPath: rapportPath,
    staticExists: fs.existsSync(staticPath),
    rapportExists: fs.existsSync(rapportPath),
    files: fs.existsSync(staticPath) ? fs.readdirSync(staticPath) : 'Directory not found'
  });
});

// Route spécifique pour le rapport client
app.get('/brutui/valide/rapport_client.html', (req, res) => {
  const filePath = path.join(__dirname, 'brutui', 'valide', 'rapport_client.html');
  console.log('🔍 Tentative de servir rapport_client.html:', filePath);
  
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error('❌ Erreur lors de l\'envoi du fichier:', err);
      res.status(404).send('Fichier non trouvé');
    } else {
      console.log('✅ Fichier rapport_client.html servi avec succès');
    }
  });
});



app.listen(PORT, () => {
  console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
  console.log(`📁 Frontend disponible sur http://localhost:${PORT}`);
  console.log(`🔗 API disponible sur http://localhost:${PORT}/api/`);
}).on('error', (err) => {
  console.error('❌ Erreur serveur:', err.message);
});

// Empêcher la fermeture
console.log('✅ Serveur en attente... (Ctrl+C pour arrêter)');