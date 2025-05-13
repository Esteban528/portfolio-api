require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const basicAuth = require('basic-auth');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;
const webhookUrl = process.env.WEBHOOK_URL;

app.use(cors());
app.use(express.json());

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
};

let cachedProjects = null;
let cachedResources = null;
let cachedPosts = null;

const basicAuthMiddleware = (req, res, next) => {
  const user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return res.status(401).send('Authentication required');
  }

  if (user.name === process.env.BASIC_AUTH_USER && user.pass === process.env.BASIC_AUTH_PASSWORD) {
    return next();
  }

  return res.status(401).send('Invalid credentials');
};

// Projects
app.get('/projects', async (req, res) => {
  if (cachedProjects) {
    return res.json(cachedProjects);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [projects] = await connection.query('SELECT * FROM projects');
    const [stacks] = await connection.query('SELECT * FROM project_stack');

    cachedProjects = projects.map(project => {
      const stack = stacks
        .filter(s => s.project_id === project.id)
        .map(s => s.technology);

      return {
        title: project.title,
        short_description: project.short_description,
        description: project.description,
        stack: stack,
        link: project.link,
        source_code: project.source_code,
        image_url: project.image_url,
        youtube_url: project.youtube_url
      };
    });

    res.json(cachedProjects);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch projects');
  } finally {
    if (connection) await connection.end();
  }
});

app.post('/projects', basicAuthMiddleware, async (req, res) => {
  const {
    title,
    short_description,
    description,
    stack,
    link,
    source_code,
    image_url,
    youtube_url
  } = req.body;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    await connection.beginTransaction();

    const [result] = await connection.execute(
      `INSERT INTO projects (title, short_description, description, link, source_code, image_url, youtube_url)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [title, short_description, description, link, source_code, image_url, youtube_url]
    );

    const projectId = result.insertId;

    for (const tech of stack || []) {
      await connection.execute(
        'INSERT INTO project_stack (project_id, technology) VALUES (?, ?)',
        [projectId, tech]
      );
    }

    await connection.commit();
    cachedProjects = null; // Invalidar cache

    res.status(201).json({ message: 'Project created', id: projectId });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error(err);
    res.status(500).send('Failed to create project');
  } finally {
    if (connection) await connection.end();
  }
});

// Resources
app.get('/resources', async (req, res) => {
  if (cachedResources) {
    return res.json(cachedResources);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [resources] = await connection.query('SELECT * FROM resources');
    cachedResources = resources;
    res.json(resources);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener recursos');
  } finally {
    if (connection) await connection.end();
  }
});

app.post('/resources', basicAuthMiddleware, async (req, res) => {
  const { title, description, link, image_url } = req.body;

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO resources (title, description, link, image_url) VALUES (?, ?, ?, ?)',
      [title, description, link, image_url]
    );

    cachedResources = null;

    res.status(201).json({ message: 'Recurso creado', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al crear recurso');
  } finally {
    if (connection) await connection.end();
  }
});

// Posts
app.get('/posts', async (req, res) => {
  if (cachedPosts) {
    return res.json(cachedPosts);
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [posts] = await connection.query('SELECT * FROM posts ORDER by id DESC');
    cachedPosts = posts;
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to fetch posts');
  } finally {
    if (connection) await connection.end();
  }
});

app.post('/posts', basicAuthMiddleware, async (req, res) => {
  const { title, date, content, description } = req.body;

  if (!content) {
    return res.status(400).json({ message: "'content' field is required" });
  }

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    const [result] = await connection.execute(
      'INSERT INTO posts (title, date, content, description) VALUES (?, ?, ?, ?)',
      [title, date, content, description]
    );

    cachedPosts = null;


    sendDiscordEmbed({
      title: title,
      url: `https://estebandev.xyz/blog/posts/${result.insertId}`,
      description: description,
      color: 0x2B4F7D,
      footerText: "estebandev.xyz/blog",
    });

    res.status(201).json({ message: 'Post created', id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to create post');
  } finally {
    if (connection) await connection.end();
  }
});

app.get('/', (req, res) => {
  res.send('Backend is running 🚀');
});

app.listen(port, () => {
  console.log(`Server is listening on http://localhost:${port}`);
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
      icon_url: embedOptions.footerIcon || "https://i.imgur.com/AfFp7pu.png"
    },
    timestamp: new Date().toISOString()
  };

  const payload = {
    username: embedOptions.username || "estebandev.xyz",
    content: "Una nueva publicación se ha subido en https://estebandev.xyz/blog \n||@here||",
    avatar_url: embedOptions.avatarUrl || "https://i.imgur.com/AfFp7pu.png",
    embeds: [embed]
  };

  fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to send embed. HTTP status: ${response.status}`);
      }
      return response.text();
    })
    .then(data => {
      console.log("Embed successfully sent.");
    })
    .catch(error => {
      console.error("An error occurred while sending the embed:", error);
    });
}
