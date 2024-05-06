const express = require("express")
const cors = require("cors")
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser")
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb")
require("dotenv").config()
const app = express()
const port = process.env.PORT || 5000

// middleware
app.use(
    cors({
        origin: ["http://localhost:5173", "https://car-doctor-client-v2.vercel.app"],
        credentials: true,
    }),
)

app.use(express.json())
app.use(cookieParser())

// const uri = "mongodb://localhost:27017"

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wkufpua.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    },
})

// custom middleware
// async optional
const logger = (req, res, next) => {
    console.log("log info:", req.method, req.url)
    next()
}

const verifyToken = (req, res, next) => {
    const token = req.cookies?.token
    console.log("token in the middleware:", token)
    if (!token) {
        return res.status(401).send({ message: "unauthorized access" })
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: "unauthorized access" })
        }
        req.user = decoded
        next()
    })
}

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect()

        const serviceCollection = client.db("carDoctor").collection("services")
        const checkOutCollection = client.db("carDoctor").collection("checkouts")

        // auth related api
        app.post("/jwt", async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "1h" })
            res.cookie("token", token, cookieOptions).send({ success: true })
        })

        app.post("/logout", async (req, res) => {
            const user = req.body
            console.log("logging out", user)
            res.clearCookie("token", { ...cookieOptions, maxAge: 0 }).send({ success: true })
        })

        // services related api
        app.get("/services", async (req, res) => {
            const cursor = serviceCollection.find()
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get("/services/:id", async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const options = {
                projection: { title: 1, price: 1, service_id: 1, img: 1 },
            }
            const result = await serviceCollection.findOne(query, options)
            res.send(result)
        })

        // checkouts
        app.get("/checkouts", logger, verifyToken, async (req, res) => {
            console.log(req.query.email)
            // console.log("cook cookies", req.cookies)
            console.log("token owner info:", req.user)
            if (req.user.userEmail !== req.query.email) {
                return res.status(403).send({ message: "forbidden access" })
            }
            let query = {}
            if (req.query?.email) {
                query = { email: req.query.email }
            }
            const result = await checkOutCollection.find(query).toArray()
            res.send(result)
        })

        app.post("/checkouts", async (req, res) => {
            const checkouts = req.body
            // console.log(checkouts)
            const result = await checkOutCollection.insertOne(checkouts)
            res.send(result)
        })

        app.patch(`/checkouts/:id`, async (req, res) => {
            const id = req.params.id
            const updatingBooking = req.body
            const filter = { _id: new ObjectId(id) }
            console.log(updatingBooking)
            const updateDoc = {
                $set: {
                    status: updatingBooking.status,
                },
            }
            const result = await checkOutCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.delete(`/checkouts/:id`, async (req, res) => {
            const id = req.params.id
            console.log(id)
            const query = { _id: new ObjectId(id) }
            const result = await checkOutCollection.deleteOne(query)
            res.send(result)
        })

        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 })
        // console.log("Pinged your deployment. You successfully connected to MongoDB!")
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close()
    }
}
run().catch(console.dir)

app.get("/", (req, res) => {
    res.send("doctor is running")
})

app.listen(port, () => {
    console.log("car doctor server is running on:", port)
})
