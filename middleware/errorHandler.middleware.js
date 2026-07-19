const errorHandler = (err, req, res, next) => {
  console.error("Error:", err.message);

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({ error: err.message });
  }

  // Not found errors
  if (err.message.includes("not found") || err.message.includes("Task not found")) {
    return res.status(404).json({ error: err.message });
  }

  // Bad request errors
  if (err.message.includes("cannot be in the past") || err.message.includes("is required")) {
    return res.status(400).json({ error: err.message });
  }

  // Authorization errors
  if (err.message.includes("Unauthorized") || err.message.includes("Forbidden")) {
    return res.status(403).json({ error: err.message });
  }

  // Default server error
  res.status(500).json({ error: "Internal server error" });
};

module.exports = errorHandler;
