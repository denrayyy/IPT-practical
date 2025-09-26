// app.js
const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
app.use(express.json());

// ==== Data loading/saving linked to db.json ====
const DB_PATH = path.join(__dirname, "db.json");

function loadDb() {
  try {
    const raw = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Failed to read db.json:", err.message);
    return { LibraryManagementSystem: { borrow: {} } };
  }
}

function saveDb(dbObject) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(dbObject, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write db.json:", err.message);
  }
}

let library = loadDb();

// ================== ROUTES ==================

// ---- BORROW ----
app.get("/borrow", (req, res) => {
  res.json(library.LibraryManagementSystem.borrow);
});

app.post("/borrow", (req, res) => {
  library.LibraryManagementSystem.borrow = req.body;
  saveDb(library);
  res.status(201).json({ message: "Borrow transaction saved!", data: req.body });
});

app.delete("/borrow/:id", (req, res) => {
  const { id } = req.params;
  let borrow = library.LibraryManagementSystem.borrow;

  if (borrow && borrow.borrow_transactionid === id) {
    library.LibraryManagementSystem.borrow = {};
    saveDb(library);
    return res.json({ message: `Borrow transaction ${id} deleted!` });
  }
  res.status(404).json({ message: "Transaction not found" });
});

// ---- BOOKS ----
app.get("/borrow/books", (req, res) => {
  const borrow = library.LibraryManagementSystem.borrow;
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  const allBooks = batches.flatMap(b => Array.isArray(b.books) ? b.books : []);
  res.json(allBooks);
});

app.get("/borrow/books/:book_id", (req, res) => {
  const { book_id } = req.params;
  const borrow = library.LibraryManagementSystem.borrow;
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  const book = batches.flatMap(b => Array.isArray(b.books) ? b.books : [])
    .find(b => b.book_id == book_id);
  if (book) return res.json(book);
  res.status(404).json({ message: "Book not found" });
});

app.post("/borrow/books", (req, res) => {
  const newBook = req.body;
  const borrow = library.LibraryManagementSystem.borrow;
  if (!Array.isArray(borrow.borrow_bookbatch) || borrow.borrow_bookbatch.length === 0) {
    library.LibraryManagementSystem.borrow.borrow_bookbatch = [{ batch_id: 1, books: [], student: {} }];
  }
  library.LibraryManagementSystem.borrow.borrow_bookbatch[0].books = library.LibraryManagementSystem.borrow.borrow_bookbatch[0].books || [];
  library.LibraryManagementSystem.borrow.borrow_bookbatch[0].books.push(newBook);
  saveDb(library);
  res.status(201).json({ message: "Book added!", data: newBook });
});

app.delete("/borrow/books/:book_id", (req, res) => {
  const { book_id } = req.params;
  const borrow = library.LibraryManagementSystem.borrow;
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  for (const batch of batches) {
    if (!Array.isArray(batch.books)) continue;
    const index = batch.books.findIndex(b => b.book_id == book_id);
    if (index !== -1) {
      batch.books.splice(index, 1);
      saveDb(library);
      return res.json({ message: `Book ${book_id} deleted!` });
    }
  }
  res.status(404).json({ message: "Book not found" });
});

// ---- STUDENTS ----
app.get("/borrow/students", (req, res) => {
  const borrow = library.LibraryManagementSystem.borrow;
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  const students = batches.map(b => b.student).filter(Boolean);
  res.json(students);
});

app.get("/borrow/students/:stud_id", (req, res) => {
  const { stud_id } = req.params;
  const borrow = library.LibraryManagementSystem.borrow;
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  const students = batches.map(b => b.student).filter(Boolean);
  const student = students.find(s => s.stud_id === stud_id);
  if (student) return res.json(student);
  res.status(404).json({ message: "Student not found" });
});

app.post("/borrow/students", (req, res) => {
  const newStudent = req.body;
  if (!Array.isArray(library.LibraryManagementSystem.borrow.borrow_bookbatch) || library.LibraryManagementSystem.borrow.borrow_bookbatch.length === 0) {
    library.LibraryManagementSystem.borrow.borrow_bookbatch = [{ batch_id: 1, books: [], student: {} }];
  }
  library.LibraryManagementSystem.borrow.borrow_bookbatch[0].student = newStudent;
  saveDb(library);
  res.status(201).json({ message: "Student saved!", data: newStudent });
});

app.delete("/borrow/students/:stud_id", (req, res) => {
  const { stud_id } = req.params;
  const borrow = library.LibraryManagementSystem.borrow;
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  for (const batch of batches) {
    if (batch.student && batch.student.stud_id === stud_id) {
      batch.student = null;
      saveDb(library);
      return res.json({ message: `Student ${stud_id} deleted!` });
    }
  }
  res.status(404).json({ message: "Student not found" });
});

// ---- AUTHORS ----
function collectAllAuthors() {
  const borrow = library.LibraryManagementSystem.borrow || {};
  const batches = Array.isArray(borrow.borrow_bookbatch) ? borrow.borrow_bookbatch : [];
  const authors = batches.flatMap(batch => {
    const books = Array.isArray(batch.books) ? batch.books : [];
    return books.flatMap(book => Array.isArray(book.authors) ? book.authors : []);
  });
  // Deduplicate by aut_id if present
  const seen = new Set();
  const unique = [];
  for (const a of authors) {
    const key = a && a.aut_id != null ? String(a.aut_id) : JSON.stringify(a);
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(a);
    }
  }
  return unique;
}

app.get("/borrow/authors", (req, res) => {
  res.json(collectAllAuthors());
});

app.get("/borrow/authors/:aut_id", (req, res) => {
  const { aut_id } = req.params;
  const authors = collectAllAuthors();
  const author = authors.find(a => a && a.aut_id == aut_id);
  if (author) return res.json(author);
  res.status(404).json({ message: "Author not found" });
});

// ---- SEARCH (deep search across ids, names, values) ----
function deepMatches(value, query) {
  if (value == null) return false;
  const q = String(query).toLowerCase();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value).toLowerCase().includes(q);
  }
  if (Array.isArray(value)) {
    return value.some(v => deepMatches(v, q));
  }
  if (typeof value === "object") {
    return Object.entries(value).some(([k, v]) => k.toLowerCase().includes(q) || deepMatches(v, q));
  }
  return false;
}

function deepCollectMatches(obj, query, path = []) {
  const results = [];
  if (obj == null) return results;
  if (typeof obj !== "object") {
    if (deepMatches(obj, query)) {
      results.push({ path: path.join("."), value: obj });
    }
    return results;
  }
  if (deepMatches(obj, query)) {
    results.push({ path: path.join("."), value: obj });
  }
  if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      results.push(...deepCollectMatches(item, query, path.concat(String(idx))));
    });
  } else {
    Object.entries(obj).forEach(([k, v]) => {
      results.push(...deepCollectMatches(v, query, path.concat(k)));
    });
  }
  return results;
}

app.get("/search", (req, res) => {
  const { q } = req.query;
  if (!q || String(q).trim() === "") {
    return res.status(400).json({ message: "Provide a query via ?q=" });
  }
  const results = deepCollectMatches(library, q);
  res.json({ query: q, count: results.length, results });
});

// ================== SERVER ==================
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
