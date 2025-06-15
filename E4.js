const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const port = 3000;

const app = express();
app.use(express.json());

let db;

// Connect to MongoDB
async function connectToMongoDB() {
    const uri = "mongodb://localhost:27017";
    const client = new MongoClient(uri);

    try {
        await client.connect();
        console.log("Connected to MongoDB!");
        db = client.db("testDB");

        // Auto-initialize 'users' if empty
        const userCount = await db.collection('users').countDocuments();
        if (userCount === 0) {
            await db.collection('users').insertMany([
                {
                    name: "Ali Customer",
                    email: "ali@example.com",
                    password: "12345",
                    role: "customer"
                },
                {
                    name: "John Driver",
                    email: "john@example.com",
                    password: "abc123",
                    role: "driver",
                    available: true
                },
                {
                    name: "Admin Boss",
                    email: "admin@example.com",
                    password: "admin123",
                    role: "admin"
                }
            ]);
            console.log("Sample users inserted");
        }

        // Auto-initialize 'rides' if empty
        const rideCount = await db.collection('rides').countDocuments();
        if (rideCount === 0) {
            const driver = await db.collection('users').findOne({ role: "driver" });
            const customer = await db.collection('users').findOne({ role: "customer" });

            if (driver && customer) {
                await db.collection('rides').insertOne({
                    customerId: customer._id,
                    driverId: driver._id,
                    pickup: "KL Sentral",
                    destination: "Mid Valley",
                    status: "pending"
                });
                console.log("Sample ride inserted");
            }
        }

    } catch (err) {
        console.error("Error connecting to MongoDB:", err);
    }
}

connectToMongoDB();

// ------------------- USER ROUTES -------------------

// POST /users – Customer Registration
app.post('/users', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const result = await db.collection('users').insertOne({
            name,
            email,
            password,
            role: role || "customer"
        });

        res.status(201).json({ id: result.insertedId });
    } catch (err) {
        res.status(400).json({ error: "Failed to register user" });
    }
});

// POST /auth/login – Customer Login
app.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password required" });
        }

        const user = await db.collection('users').findOne({ email, password });

        if (!user) {
            return res.status(401).json({ error: "Unauthorized – invalid credentials" });
        }

        res.status(200).json({ message: "Login successful", userId: user._id });
    } catch (err) {
        res.status(400).json({ error: "Login failed" });
    }
});

// PATCH /drivers/:id/status – Update Driver Availability
app.patch('/drivers/:id/status', async (req, res) => {
    try {
        const driverId = new ObjectId(req.params.id);
        const { availability } = req.body;

        if (typeof availability !== "boolean") {
            return res.status(400).json({ error: "Availability must be a boolean" });
        }

        const result = await db.collection('users').updateOne(
            { _id: driverId, role: "driver" },
            { $set: { available: availability } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Driver not found" });
        }

        res.status(200).json({ updated: result.modifiedCount });
    } catch (err) {
        res.status(400).json({ error: "Invalid ID or data" });
    }
});

// ------------------- RIDE ROUTES -------------------

// GET /rides – Fetch all rides
app.get('/rides', async (req, res) => {
    try {
        const rides = await db.collection('rides').find().toArray();
        res.status(200).json(rides);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch rides" });
    }
});

// POST /rides – Create a new ride
app.post('/rides', async (req, res) => {
    try {
        const result = await db.collection('rides').insertOne(req.body);
        res.status(201).json({ id: result.insertedId });
    } catch (err) {
        res.status(400).json({ error: "Invalid ride data" });
    }
});

// PATCH /rides/:id – Update ride status
app.patch('/rides/:id', async (req, res) => {
    try {
        const result = await db.collection('rides').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: { status: req.body.status } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        res.status(200).json({ updated: result.modifiedCount });
    } catch (err) {
        res.status(400).json({ error: "Invalid ride ID or data" });
    }
});

// PUT /rides/:id – Replace entire ride and return status
app.put('/rides/:id', async (req, res) => {
    try {
        if (req.body._id) {
            delete req.body._id;
        }

        const rideId = new ObjectId(req.params.id);

        const result = await db.collection('rides').replaceOne(
            { _id: rideId },
            req.body
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        const updatedRide = await db.collection('rides').findOne({ _id: rideId });
        res.status(200).json({ status: updatedRide.status });

    } catch (err) {
        res.status(400).json({ error: "Invalid ride ID or data" });
    }
});

// DELETE /rides/:id – Delete a ride
app.delete('/rides/:id', async (req, res) => {
    try {
        const result = await db.collection('rides').deleteOne({
            _id: new ObjectId(req.params.id)
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ error: "Ride not found" });
        }

        res.status(200).json({ deleted: result.deletedCount });
    } catch (err) {
        res.status(400).json({ error: "Invalid ride ID" });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
