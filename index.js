const express = require('express')
const cors = require('cors')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')
const app = express()
require('dotenv').config()


const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

// middle were
app.use(cors({
  origin:['http://localhost:5173',
    'https://job-portal-project-c5ed1.web.app',
    'https://job-portal-project-c5ed1.firebaseapp.com'
  ],
  credentials:true
}))

app.use(express.json())
app.use(cookieParser())


// const logger = (req , res , next)=>{
//   console.log('inside the logger')
//   next()
// }

const verifyToken =(req , res , next)=>{
  console.log('inside the verifyToken middleWere', req.cookies)
  const token = req.cookies?.token

  if(!token){
    return res.status(401).send({message:'Unauthorized access'})
  }

  // verify token
  jwt.verify(token , process.env.ACCESS_TOKEN_SECRET, (err , decoded)=>{
    if(err){
      return res.status(401).send({message:'Unauthorized access'})

    }
    req.user = decoded
    next()

  })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.tu2ve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log("Pinged your deployment. You successfully connected to MongoDB!");

    // job releted Apis
    const jobsCollection = client.db('job-portal').collection('jobs')
    const jobApplicationCollection = client.db('job-portal').collection('job-applications')

    // Auth releted apis
    app.post('/jwt', async(req , res)=>{
      const user = req.body
      const token =jwt.sign(user , process.env.ACCESS_TOKEN_SECRET, {expiresIn:'9h'})
      res.cookie('token', token, {
        httpOnly:true,
        secure:process.env.NODE_ENV==='production',
        sameSite:process.env.NODE_ENV==='production'?'none':'strict'
      })
      .send({success: true})
    })

    app.post('/logOut', (req , res)=>{
      res.clearCookie('token',{
        httpOnly: true,
        secure: process.env.NODE_ENV==='production',
        sameSite:process.env.NODE_ENV==='production'?'none':'strict'

      })
      res.send({success:true})
    })




  //  all jobs
    app.get('/jobs',  async(req , res)=>{
      console.log('now inside the logger')
      const email = req.query.email
      let query ={}
      if(email){
        query={hr_email:email}
      }
        const cursor = jobsCollection.find(query)
        const result = await cursor.toArray()
        res.send(result)

    })




    // job details
    app.get('/jobs/:id', async(req, res)=>{
      const id = req.params.id
      const query= {_id: new ObjectId(id)}
      const result = await jobsCollection.findOne(query)
      res.send(result)
    })
    app.post('/jobs',async(req , res)=>{
      const newJob = req.body
      const result = await jobsCollection.insertOne(newJob)
      res.send(result)
    })

    // job applications apis
    app.get('/job-applications',verifyToken, async(req , res)=>{
      const email = req.query.email
      const query = { applicant_email: email}

      console.log(req.cookies?.token)

      if(req.user.email !== req.query.email){
        return res.status(403).send({message:'forbidden access'})
      }


      const result = await jobApplicationCollection.find(query).toArray()

      // show job application fokira way

      for(const application of result){
        console.log(application.job_id)
        const query1 = {_id: new ObjectId(application.job_id)}
        const job =await jobsCollection.findOne(query1)
        if(job){
          application.title = job.title
          application.company= job.company
          application.company_logo = job.company_logo
          application.location = job.location
        }
      }
      res.send(result)
    })

    // get a specific job application by id

    app.get('/job-applications/:job_id', async(req , res)=>{
      const jobId = req.params.job_id
      console.log(jobId)
      const query = {job_id:{id:jobId}}
      const result=await jobApplicationCollection.find(query).toArray()

      res.send(result)
    })


    app.post('/job-applications', async(req , res)=>{
      const application = req.body
      const result = await jobApplicationCollection.insertOne(application)

      // not the best way(use aggregate)
      const id = application.job_id
      const query = {_id: new ObjectId(id)}
      const job = await jobsCollection.findOne(query)
      let count =0
      if(job.applicationCount){
        count = job.applicationCount +1
      }
      else{
        count = 1
      }

      // now update the job info
      const filter = {_id:new ObjectId(id)}
      const updateDoc = {
        $set: {
          applicationCount: count
        }
      }
      const updateResult = await jobsCollection.updateOne(filter , updateDoc)
      res.send(result)
    })

    // status update
    app.patch('/job-applications/:id', async(req , res)=>{
      const id = req.params.id
      const data = req.body
      const filter = {_id: new ObjectId(id)}
      const updateDoc = {
        $set:{
          status:data.status
        }
      }
      const result = await jobApplicationCollection.updateOne(filter , updateDoc)
      res.send(result)
    })
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res)=>{
    res.send('job is falling from the sky')
})

app.listen(port, ()=>{
    console.log(`job is waiting at : ${port}`)
})
