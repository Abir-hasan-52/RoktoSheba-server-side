const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

// local environment variable from .env file
dotenv.config();

const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);

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
    const blogsCollection = db.collection("blogs");
    const fundingCollection = db.collection("fundings");

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

    // GET with pagination and status filter
    app.get("/users", async (req, res) => {
      const { page = 0, limit = 10, status } = req.query;
      const query = status && status !== "all" ? { status } : {};
      const cursor = usersCollection
        .find(query)
        .skip(Number(page) * Number(limit))
        .limit(Number(limit));
      const users = await cursor.toArray();
      const totalCount = await usersCollection.countDocuments(query);
      res.send({ users, totalCount });
    });

    // PATCH routes
    // PATCH: Update any field (status, role)
    app.patch("/users/:id", async (req, res) => {
      const id = req.params.id;
      const update = req.body;

      if (!update || Object.keys(update).length === 0) {
        return res.status(400).send({ error: "No update data provided." });
      }

      const result = await usersCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: update }
      );
      res.send(result);
    });

    // donation data store

    // route: POST /createDonation
    // POST /createDonation
    app.post("/createDonation", async (req, res) => {
      try {
        const donationData = req.body;
        const result = await donationCollection.insertOne(donationData);
        res.send(result);
      } catch (error) {
        console.error("Error creating donation:", error);
        res.status(500).json({ message: "Failed to create donation" });
      }
    });

    // GET /my-donations?email=user@example.com&page=0&limit=10
    // In index.js or routes file
    app.get("/myDonations", async (req, res) => {
      try {
        const { email, page = 0, limit = 5 } = req.query;

        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }

        const db = client.db("roktoSheba");
        const donationCollection = db.collection("donations");

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);

        const query = { requesterEmail: email };

        const totalCount = await donationCollection.countDocuments(query);

        const donations = await donationCollection
          .find(query)
          .sort({ createdAt: -1 }) // Newest first
          .skip(pageNum * limitNum)
          .limit(limitNum)
          .toArray();

        res.send({ totalCount, donations });
      } catch (error) {
        console.error("❌ Error in /myDonations:", error.message);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    // all donation get
    app.get("/allDonations", async (req, res) => {
      try {
        const { page = 0, limit = 10 } = req.query;
        const skip = parseInt(page) * parseInt(limit);

        const total = await donationCollection.countDocuments();

        const donations = await donationCollection
          .find({})
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({ total, donations });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch donation requests." });
      }
    });

    //all donation request by id
    app.patch("/donations/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { status } = req.body;

        const result = await donationCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: "Failed to update status." });
      }
    });

    // Create a new blog (status defaults to 'draft')
    app.post("/blogs", async (req, res) => {
      try {
        const { title, thumbnail, content, authorEmail } = req.body;
        if (!title || !thumbnail || !content || !authorEmail) {
          return res.status(400).send({ message: "Missing required fields" });
        }

        const newBlog = {
          title,
          thumbnail,
          content,
          status: "draft",
          authorEmail,
          createdAt: new Date(),
        };

        const result = await blogsCollection.insertOne(newBlog);
        res
          .status(201)
          .send({ message: "Blog created", blogId: result.insertedId });
      } catch (error) {
        console.error("Error creating blog:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Get blogs with optional filtering and pagination
    app.get("/blogs", async (req, res) => {
      try {
        const { status, page = 0, limit = 10 } = req.query;
        const query = {};

        if (status && status !== "all") {
          query.status = status;
        }

        const skip = parseInt(page) * parseInt(limit);
        const totalCount = await blogsCollection.countDocuments(query);

        const blogs = await blogsCollection
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .toArray();

        res.send({ totalCount, blogs });
      } catch (error) {
        console.error("Error fetching blogs:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Update blog (status, title, thumbnail, content) - only admin allowed to update status
    app.patch("/blogs/:id", async (req, res) => {
      try {
        const blogId = req.params.id;
        const updateFields = req.body; // e.g., { status: 'published' } or { title: 'new title' }

        if (!ObjectId.isValid(blogId)) {
          return res.status(400).send({ message: "Invalid blog ID" });
        }

        const result = await blogsCollection.updateOne(
          { _id: new ObjectId(blogId) },
          { $set: updateFields }
        );

        if (result.matchedCount === 0) {
          return res.status(404).send({ message: "Blog not found" });
        }

        res.send({ message: "Blog updated successfully" });
      } catch (error) {
        console.error("Error updating blog:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // Delete a blog - only admin
    app.delete("/blogs/:id", async (req, res) => {
      try {
        const blogId = req.params.id;

        if (!ObjectId.isValid(blogId)) {
          return res.status(400).send({ message: "Invalid blog ID" });
        }

        const result = await blogsCollection.deleteOne({
          _id: new ObjectId(blogId),
        });

        if (result.deletedCount === 0) {
          return res.status(404).send({ message: "Blog not found" });
        }

        res.send({ message: "Blog deleted successfully" });
      } catch (error) {
        console.error("Error deleting blog:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    // GET: /published-blogs
    app.get("/published-blogs", async (req, res) => {
      try {
        const publishedBlogs = await blogsCollection
          .find({ status: "published" })
          .sort({ createdAt: -1 }) // show latest first
          .toArray();

        res.send(publishedBlogs);
      } catch (error) {
        res.status(500).send({ message: "Failed to load published blogs." });
      }
    });

    //  funding

    app.post("/create-payment-intent", async (req, res) => {
      const amountInCents = req.body.amountInCents;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amountInCents, // Amount in cents
          currency: "usd",
          payment_method_types: ["card"],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    //  post funding info
    app.post("/fundings", async (req, res) => {
      const fund = req.body;

      // Basic validation
      if (!fund.userId || !fund.amount) {
        return res.status(400).send({ error: "Missing fields" });
      }

      fund.date = new Date();

      try {
        const result = await fundingCollection.insertOne(fund);
        res.send(result);
      } catch (err) {
        console.error("Failed to add fund", err);
        res.status(500).send({ error: "Internal server error" });
      }
    });

    // get funding info in the table formate
    app.get("/fundings", async (req, res) => {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;

      const skip = (page - 1) * limit;

      try {
        const cursor = db
          .collection("fundings")
          .find()
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit);

        const fundings = await cursor.toArray();
        const total = await fundingCollection.countDocuments();

        res.send({ fundings, total });
      } catch (err) {
        res.status(500).send({ error: "Failed to fetch funding data" });
      }
    });

    // for home page 3 card feature api stats

    app.get("/dashboard-stats", async (req, res) => {
      try {
        // 1. Total Donors (users with role = 'donor')
        const totalDonors = await usersCollection.countDocuments({
          role: "donor",
        });

        // 2. Total Funding (sum of all funding amount)
        // const fundingDocs = await fundingCollection.find({}).toArray();
        // const totalFunding = fundingDocs.reduce(
        //   (acc, curr) => acc + (curr.amount || 0),
        //   0
        // );

        // 3. Total Blood Donation Requests
        const totalRequests = await donationCollection.countDocuments();

        res.send({
          totalDonors,
          //   totalFunding,
          totalRequests,
        });
      } catch (err) {
        res.status(500).send({ message: "Failed to fetch dashboard stats." });
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
