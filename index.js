const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware setup
app.use(cors({
  origin: ['http://localhost:5173'], // Update this in production
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// MongoDB connection URI and client setup
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.eyvufda.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

// Logger middleware for tracking requests
const logger = (req, res, next) => {
  console.log('Request:', req.method, req.originalUrl);
  next();
};

// JWT token verification middleware
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  console.log('JWT token:', token);

  if (!token) return res.status(401).send({ message: 'Unauthorized access' });

  jwt.verify(token, process.env.SECRET_ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      console.log('JWT error:', err);
      return res.status(401).send({ message: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// Main function to handle MongoDB connection and routes
async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    // Define collections
    const serviceCollection = client.db('carDoctor').collection('services');
    const bookingCollection = client.db('carDoctor').collection('bookings');

    // JWT route to issue a token
    app.post('/jwt', logger, (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_ACCESS_TOKEN, { expiresIn: '1h' });
      res.cookie('token', token, { httpOnly: true, secure: false }).send({ success: true });
    });

    // Route to log out user and clear token
    app.post('/logout', (req, res) => {
      console.log('Logging out user');
      res.clearCookie('token').send({ success: true });
    });

    // Get all services
    app.get('/services', logger, async (req, res) => {
      try {
        const services = await serviceCollection.find().toArray();
        res.send(services);
      } catch (error) {
        console.error("Failed to retrieve services:", error);
        res.status(500).send({ message: 'Failed to retrieve services' });
      }
    });

    // Get specific service by ID
    app.get('/services/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const service = await serviceCollection.findOne(
          { _id: new ObjectId(id) },
          { projection: { service_id: 1, title: 1, img: 1, price: 1 } }
        );
        service ? res.send(service) : res.status(404).send({ message: "Service not found" });
      } catch (error) {
        console.error("Failed to retrieve service by ID:", error);
        res.status(500).send({ message: 'Failed to retrieve service' });
      }
    });

    // Create a new booking
    app.post('/bookings', async (req, res) => {
      try {
        const booking = req.body;
        const result = await bookingCollection.insertOne(booking);
        res.send(result);
      } catch (error) {
        console.error("Failed to create booking:", error);
        res.status(500).send({ message: 'Failed to create booking' });
      }
    });

    // Get bookings, with optional email filter and token verification
    app.get('/bookings', logger, verifyToken, async (req, res) => {
      console.log(req.query.email);
      console.log('Token owner info: ', req.user);
      if (req.user.email !== req.query.email) {
        return res.status(403).send({ message: 'Forbidden access' })
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }
      const result = await bookingCollection.find(query).toArray()
      res.send(result)
    });

    // Update booking status by ID
    app.patch('/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const updatedBooking = req.body;
        const result = await bookingCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: updatedBooking.status } }
        );
        res.send(result);
      } catch (error) {
        console.error("Failed to update booking:", error);
        res.status(500).send({ message: 'Failed to update booking' });
      }
    });

    // Delete a booking by ID
    app.delete('/bookings/:id', async (req, res) => {
      try {
        const id = req.params.id;
        const result = await bookingCollection.deleteOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (error) {
        console.error("Failed to delete booking:", error);
        res.status(500).send({ message: 'Failed to delete booking' });
      }
    });

  } catch (error) {
    console.error("MongoDB connection failed:", error);
  }
}

// Run main function
run().catch(console.dir);

// Root route to confirm server is running
app.get('/', (req, res) => {
  res.send('Doctor is running');
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});