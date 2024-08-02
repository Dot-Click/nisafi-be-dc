const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const ApiError = require("./utils/ApiError");
const app = express();
const router = require("./router");
const loggerMiddleware = require("./middleware/loggerMiddleware");
const swaggerUi = require("swagger-ui-express");
const swaggerFile = require("../swagger_output.json"); // Generated Swagger file
const fileUpload = require("express-fileupload");
const path = require("path");
const User = require("./models/User/user");
const { createPayout } = require("./functions/paypal");

// console.log("serviceAccount", serviceAccount);
// Middlewares
app.use(express.json());
app.use(cors());
app.options("*", cors());
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(loggerMiddleware);
app.use(fileUpload());
app.use(
  "/uploads",
  // "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);

// router index
app.use("/", router);
// api doc
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));
// webhook index
// app.use("/webhooks", webhookRouter);

app.get("/", async (req, res) => {
  // await createPayout({
  //   email: "sb-z4368c30364532@personal.example.com",
  //   amount: 5000,
  //   id:123456789,
    
  // })
  res.send("BE-boilerplate v1.1");
});

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
  next(new ApiError(404, "Not found"));
});

module.exports = app;
