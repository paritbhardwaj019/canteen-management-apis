const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const config = require("./config/config");
const { errorHandler, notFoundHandler } = require("./utils/api.error");

const authRoutes = require("./routes/v1/auth.routes");
const roleRoutes = require("./routes/v1/role.routes");
const userRoutes = require("./routes/v1/user.routes");
const mealRoutes = require("./routes/v1/meal.routes");
const esslRoutes = require("./routes/v1/essl.routes");
const mealRequestRoutes = require("./routes/v1/mealRequest.routes");
const permissionRoutes = require("./routes/v1/permission.routes");
const visitorRoutes = require("./routes/v1/visitor.routes");
const visitorAuthRoutes = require("./routes/v1/visitorAuth.routes");
const canteenRoutes = require("./routes/v1/canteen.routes");
const plantRoutes = require("./routes/v1/plant.routes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(helmet());
app.use(cors(config.cors));
app.use(morgan("dev"));

app.use(
  rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: {
      status: "error",
      message: "Too many requests, please try again later.",
    },
  })
);

const apiPrefix = config.server.apiPrefix;

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/roles`, roleRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/meals`, mealRoutes);
app.use(`${apiPrefix}/essl`, esslRoutes);
app.use(`${apiPrefix}/requests`, mealRequestRoutes);
app.use(`${apiPrefix}/permissions`, permissionRoutes);
app.use(`${apiPrefix}/visitors`, visitorRoutes);
app.use(`${apiPrefix}/visitor-auth`, visitorAuthRoutes);
app.use(`${apiPrefix}/canteen`, canteenRoutes);
app.use(`${apiPrefix}/plants`, plantRoutes);

app.get(`${apiPrefix}/health`, (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Server is running",
    timestamp: new Date(),
  });
});

app.use(notFoundHandler);

app.use(errorHandler);

module.exports = app;
