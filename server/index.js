// server/index.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // Allow frontend to connect
app.use(express.json()); // Accept JSON data

// 1. REGISTER A NEW USER
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, phone, password, role } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { phone } });
    if (existingUser) return res.status(400).json({ error: "Phone number already registered" });

    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user in database
    const user = await prisma.user.create({
      data: { name, phone, password: hashedPassword, role: role || "FARMER" }
    });

    res.status(201).json({ message: "User created successfully", userId: user.id });
  } catch (error) {
    res.status(500).json({ error: "Registration failed" });
  }
});

// 2. LOGIN
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Find user
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    // Check password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: "Invalid credentials" });

    // Create and send a JWT token
    const token = jwt.sign(
      { id: user.id, role: user.role }, 
      process.env.JWT_SECRET || "zambia_agri_secret", 
      { expiresIn: '7d' }
    );

    res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: "Login failed" });
  }
});

// --- MARKETPLACE ROUTES ---

// 1. GET ALL PRODUCTS
app.get('/api/products', async (req, res) => {
  try {
    const { category } = req.query; // e.g., ?category=Inputs or ?category=Produce
    const filter = category ? { category } : {};
    
    const products = await prisma.product.findMany({
      where: filter,
      include: { seller: { select: { name: true, phone: true } } }, // Include seller info
      orderBy: { createdAt: 'desc' }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
});

// 2. CREATE A NEW PRODUCT (Farmers Only)
app.post('/api/products', async (req, res) => {
  try {
    // In a real app, you would verify the JWT token here to get the sellerId
    const { name, description, price, category, stock, imageUrl, sellerId, sellerPhone } = req.body;

    const newProduct = await prisma.product.create({
      data: {
        name,
        description,
        price: parseFloat(price),
        category, // "Produce" or "Inputs"
        stock: parseInt(stock),
        imageUrl: imageUrl || "https://via.placeholder.com/150",
        sellerId: sellerId,
      }
    });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to create product" });
  }
});

// Test Route
app.get('/', (req, res) => {
  res.send('Zambia Agri Hub API is running!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});