const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// local environment variable from .env file
dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kxazpdy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // collection
    const db = client.db("roktoSheba");
    const usersCollection = db.collection("users");
    const donationCollection = db.collection("donations");

    // Register new user
    app.post("/users", async (req, res) => {
      const email = req.body.email;
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const user = req.body;
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    // route: GET /users/:email
    app.get("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;

        const user = await db.collection("users").findOne({ email });

        if (user) {
          res.send(user);
        } else {
          res.status(404).json({ message: "User not found" });
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });

    // donation data store

    // route: POST /createDonation
    // POST /createDonation
    app.post("/createDonation", async (req, res) => {
      try {
        const donationData = req.body;
        const result = await  donationCollection.insertOne(donationData);
        res.send(result);
      } catch (error) {
        console.error("Error creating donation:", error);
        res.status(500).json({ message: "Failed to create donation" });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// simple route
app.get("/", (req, res) => {
  res.send("RoktoSheba Server is Running ✅");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
