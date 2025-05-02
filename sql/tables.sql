CREATE TABLE projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  short_description TEXT NOT NULL,
  description TEXT NOT NULL,
  link VARCHAR(512),
  source_code VARCHAR(512),
  image_url VARCHAR(512),
  youtube_url VARCHAR(512)
);

CREATE TABLE project_stack (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL,
  technology VARCHAR(100) NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE resources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  link VARCHAR(512),
  image_url VARCHAR(512)
);

CREATE TABLE posts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date DATE NOT NULL,
  content TEXT NOT NULL,
  description TEXT NOT NULL
);
