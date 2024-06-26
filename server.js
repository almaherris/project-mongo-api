import express from "express"
import cors from "cors"
import mongoose from "mongoose"
import expressListEndpoints from "express-list-endpoints"
import { Restaurant } from "./models/Restaurant"
import michelinData from "./data/michelin-data.json"

//Set up MongoURL and localhost
const mongoUrl = process.env.MONGO_URL || "mongodb://localhost/restaurants"
mongoose.connect(mongoUrl)
mongoose.Promise = Promise

if (process.env.RESET_DB) {
  const seedDatabase = async () => {
    await Restaurant.deleteMany()
    //insert each document in the array into the collection
    await Restaurant.insertMany(michelinData)
  }
  seedDatabase()
}

// Defines the port the app will run on. Defaults to 8080, but can be overridden
// when starting the server. Example command to overwrite PORT env variable value:
// PORT=9000 npm start
const port = process.env.PORT || 3000
const app = express()

// Add middlewares to enable cors and json body parsing
app.use(cors())
app.use(express.json())

// Endpoint listing and guidance for using query endpoints
app.get("/", (req, res) => {
  const endpoints = expressListEndpoints(app).map((endpoint) => {
    if (endpoint.path === "/restaurants") {
      endpoint.query = {
        description:
          "There are 100 restaurants displayed per page in this endpoint. To see another page, add query endpoint like this '?page=3'.",
      }
    }

    if (endpoint.path === "/restaurants/:query") {
      endpoint.query = {
        description:
          "Add query endpoint to search for restaurant name or ID. If name includes more than one word, add a space between the words. ID should be a number between 1 and 6,700",
      }
    }

    if (endpoint.path === "/cuisines/:cuisine") {
      endpoint.query = {
        description:
          "Add query endpoint to search for cuisine type. See endpoint '/cuisines' for examples of different cuisines. If cuisine type includes more than one word, add space between the words.",
      }
    }

    if (endpoint.path === "/locations/:location") {
      endpoint.query = {
        description:
          "Add query endpoint to search for city or country. If location name includes more than one word, add space between the words.",
      }
    }

    return endpoint
  })
  res.json(endpoints)
})

// All restaurants grouped by 100 per page
app.get("/restaurants", async (req, res) => {
  //Parse query parameters for pagination
  const page = parseInt(req.query.page) || 1 //Defaults to page 1 if invalid
  const limit = 100 //Display 100 restaurants per page
  const skip = (page - 1) * limit //Calc the number of restos to skip for current page

  try {
    const allRestaurants = await Restaurant.find().skip(skip).limit(limit)

    if (allRestaurants.length > 0) {
      res.json(allRestaurants)
    } else {
      res.status(404).send("No restaurants with this criteria")
    }
  } catch (error) {
    console.error("Error fetching restaurants", error)
    res.status(500).send("Internal Server Error")
  }
})

//Filter one restaurant based on ID or name
app.get("/restaurants/:query", async (req, res) => {
  const { query } = req.params

  //Give message if query is a number (indicates ID search)
  if (!isNaN(query)) {
    try {
      const restaurantById = await Restaurant.findOne({ id: query })
      if (restaurantById) {
        return res.json(restaurantById)
      } else {
        return res
          .status(404)
          .send(
            "Invalid restaurant ID. Please search for a number between 1 and 6700"
          )
      }
    } catch (error) {
      console.error("Error fetching restaurant by ID", error)
      return res.status(500).send("Internal Server Error")
    }
  }

  //If query is NaN, treat as name search
  try {
    const restaurantByName = await Restaurant.findOne({
      name: { $regex: new RegExp("^" + query + "$", "i") }, // Ensure case-insensitive match fron beginning "^" to end "$"
    })
    if (restaurantByName) {
      res.json(restaurantByName)
    } else {
      res
        .status(404)
        .send(
          "No restaurant with this criteria. For names - if the name has more than two words, add a space between the words. For IDs - try a number between 1-6700"
        )
    }
  } catch (error) {
    console.error("Error fetching restaurant by name", error)
    res.status(500).send("Internal Server Error")
  }
})

// Get all unique cuisines
app.get("/cuisines", async (req, res) => {
  try {
    const uniqueCuisines = await Restaurant.distinct("cuisine")
    res.json(uniqueCuisines)
  } catch (error) {
    console.error("Error fetching unique cuisines", error)
    res.status(500).send("Internal Server Error")
  }
})

// Filter on cuisine
app.get("/cuisines/:cuisine", async (req, res) => {
  const { cuisine } = req.params

  // Split the cuisine parameter into an array of individual words
  const cuisineSearchWords = cuisine
    .split(",")
    .map((word) => word.trim().toLowerCase())

  try {
    // Find restaurants whose cuisine includes search words as WHOLE words

    const restaurantsByCuisine = await Restaurant.find({
      cuisine: {
        //Iterate over each word in the searchWords array
        //  "\\b"is word boundary ensuring that the word is matched as a whole word and not part of a larger word
        //For example this would not render anything if you search only for 1 letter
        //Before I added this, "i" would for example return cuisines like "italian" when it should return nothing
        $all: cuisineSearchWords.map(
          (word) => new RegExp("\\b" + word + "\\b", "i")
        ),
      },
    })

    if (restaurantsByCuisine.length > 0) {
      res.json(restaurantsByCuisine)
    } else {
      res
        .status(404)
        .send(
          "No restaurants found in this cuisine, try searching for a cuisine found in the endpoint '/cuisines'."
        )
    }
  } catch (error) {
    console.error("Error fetching restaurants by cuisine", error)
    res.status(500).send("Internal Server Error")
  }
})

// Filter on location
app.get("/locations/:location", async (req, res) => {
  const { location } = req.params

  const locationSearchWords = location
    .split(",")
    .map((word) => word.trim().toLowerCase())

  try {
    const restaurantsByLocation = await Restaurant.find({
      location: {
        $all: locationSearchWords.map(
          (word) => new RegExp("\\b" + word + "\\b", "i")
        ),
      },
    })

    if (restaurantsByLocation.length > 0) {
      res.json(restaurantsByLocation)
    } else {
      res
        .status(404)
        .send("No restaurants found in this location, try another one!")
    }
  } catch (error) {
    console.error("Error fetching restaurants by location", error)
    res.status(500).send("Internal Server Error")
  }
})

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`)
})
