require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const basicAuth = require("basic-auth");
const cors = require("cors");

const app = express();
const port = process.env.PORT || 3000;
const webhookUrl = process.env.WEBHOOK_URL;

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

let connection;

async function initDb() {
  connection = await mysql.createConnection(dbConfig);
  console.log("Conectado a MySQL");
}

app.use(cors());
app.use(express.json());

let cachedProjects = null;
let cachedResources = null;
let cachedPosts = null;

const basicAuthMiddleware = (req, res, next) => {
  const user = basicAuth(req);
  if (!user || !user.name || !user.pass) {
    return res.status(401).send("Authentication required");
  }
  if (
    user.name === process.env.BASIC_AUTH_USER &&
    user.pass === process.env.BASIC_AUTH_PASSWORD
  ) {
    return next();
  }
  return res.status(401).send("Invalid credentials");
};

// Projects
app.get("/projects", async (req, res) => {
  if (cachedProjects) return res.json(cachedProjects);

  try {
    const [projects] = await connection.query("SELECT * FROM projects");
    const [stacks] = await connection.query("SELECT * FROM project_stack");

    cachedProjects = projects.map((project) => {
      const stack = stacks
        .filter((s) => s.project_id === project.id)
        .map((s) => s.technology);

      return { ...project, stack };
    });

    res.json(cachedProjects);
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to fetch projects");
  }
});

// Posts (corregido)
app.post("/posts", basicAuthMiddleware, async (req, res) => {
  const { title, date, content, description } = req.body;

  if (!content) {
    return res.status(400).json({ message: "'content' field is required" });
  }

  try {
    const [result] = await connection.execute(
      "INSERT INTO posts (title, date, content, description) VALUES (?, ?, ?, ?)",
      [title, date, content, description]
    );

    cachedPosts = null;

    sendDiscordEmbed({
      title,
      url: `https://estebandev.xyz/blog/posts/${result.insertId}`,
      description,
      color: 0x2b4f7d,
      footerText: "estebandev.xyz/blog",
    });

    res.status(201).json({ message: "Post created", id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to create post");
  }
});

app.get("/", (req, res) => {
  res.send("Backend is running");
});

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`Server is listening on http://localhost:${port}`);
    });
  })
  .catch((err) => {
    console.error("Error al conectar a MySQL:", err);
    process.exit(1);
  });

function sendDiscordEmbed(embedOptions = {}) {
  const embed = {
    title: embedOptions.title || "Embed Title",
    description: embedOptions.description || "Embed description",
    url: embedOptions.url || undefined,
    color: embedOptions.color || 0x00bfff,
    fields: embedOptions.fields || [],
    footer: {
      text: embedOptions.footerText || "Footer text",
      icon_url:
        embedOptions.footerIcon || "https://i.imgur.com/AfFp7pu.png",
    },
    timestamp: new Date().toISOString(),
  };

  const payload = {
    username: embedOptions.username || "estebandev.xyz",
    content:
      "Una nueva publicación se ha subido en https://estebandev.xyz/blog \n||@here||",
    avatar_url:
      embedOptions.avatarUrl || "https://i.imgur.com/AfFp7pu.png",
    embeds: [embed],
  };

  fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to send embed. HTTP status: ${response.status}`);
      }
      return response.text();
    })
    .then(() => console.log("Embed successfully sent."))
    .catch((error) =>
      console.error("Error while sending the embed:", error)
    );
}
