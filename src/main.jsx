
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen, Brain, CalendarDays, Check, ChevronRight,
  FileText, Heart, Lightbulb, Menu, Pencil, Plus,
  Search, Sparkles, Target, Trash2, Upload, X
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfWorker from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import mammoth from "mammoth/mammoth.browser";
import JSZip from "jszip";
import "./styles.css";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const STORAGE_KEY = "studybloom-data";
const FILE_DB_NAME = "studybloom-files";
const FILE_STORE_NAME = "files";
const AI_API_URL = "https://studybloom-api-s83v.vercel.app/api/ai";

const starterData = {
  profile: { name: "" },
  courses: [],
  materials: [],
  notes: [],
  flashcards: [],
  questions: [],
  summaries: [],
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return starterData;
    return { ...starterData, ...JSON.parse(saved) };
  } catch {
    return starterData;
  }
}

// =====================================================
// ALMACENAMIENTO LOCAL DE ARCHIVOS
// =====================================================

function openFileDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FILE_DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE_NAME)) {
        db.createObjectStore(FILE_STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFileData(id, file, text) {
  const db = await openFileDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, "readwrite");

    transaction.objectStore(FILE_STORE_NAME).put({
      id,
      blob: file,
      text,
      name: file.name,
      type: file.type,
    });

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function getFileData(id) {
  const db = await openFileDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, "readonly");
    const request = transaction.objectStore(FILE_STORE_NAME).get(id);

    request.onsuccess = () => {
      db.close();
      resolve(request.result || null);
    };

    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function deleteFileData(id) {
  const db = await openFileDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(FILE_STORE_NAME, "readwrite");
    transaction.objectStore(FILE_STORE_NAME).delete(id);

    transaction.oncomplete = () => {
      db.close();
      resolve();
    };

    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

// =====================================================
// EXTRAER TEXTO DE DOCUMENTOS
// =====================================================

async function extractFileText(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    return file.text();
  }

  if (name.endsWith(".pdf")) {
    const pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(await file.arrayBuffer()),
    }).promise;

    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();

      pages.push(
        content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
      );
    }

    return pages.join("\n\n");
  }

  if (name.endsWith(".docx")) {
    const result = await mammoth.extractRawText({
      arrayBuffer: await file.arrayBuffer(),
    });
    return result.value;
  }

  if (name.endsWith(".pptx")) {
    const zip = await JSZip.loadAsync(file);

    const slideFiles = Object.keys(zip.files)
      .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
      .sort((a, b) => {
        const numA = Number(a.match(/slide(\d+)/)[1]);
        const numB = Number(b.match(/slide(\d+)/)[1]);
        return numA - numB;
      });

    const slides = [];

    for (const path of slideFiles) {
      const xml = await zip.files[path].async("text");
      const document = new DOMParser().parseFromString(xml, "text/xml");

      slides.push(
        Array.from(document.getElementsByTagName("a:t"))
          .map((node) => node.textContent)
          .join(" ")
      );
    }

    return slides.join("\n\n");
  }

  if (name.endsWith(".doc") || name.endsWith(".ppt")) {
    throw new Error(
      "Formato antiguo no compatible. Guarda el archivo como DOCX o PPTX."
    );
  }

  if (file.type.startsWith("image/")) {
    return "";
  }

  throw new Error("Formato no compatible. Utiliza PDF, DOCX, PPTX o TXT.");
}

// =====================================================
// CONEXIÓN CON LA API DE IA
// =====================================================

async function callStudyBloomAI(action, materialText, question = "") {
  if (!materialText.trim()) {
    throw new Error(
      "No encuentro texto legible en los materiales de este curso. Agrega un PDF con texto, DOCX, PPTX o TXT."
    );
  }

  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action,
      materialText: materialText.slice(0, 30000),
      question,
    }),
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      result.error || result.message || "No se pudo conectar con la IA."
    );
  }

  if (typeof result.result === "string") return result.result;
  if (typeof result.text === "string") return result.text;
  if (typeof result.answer === "string") return result.answer;
  if (typeof result.content === "string") return result.content;

  return JSON.stringify(result, null, 2);
}

// =====================================================
// APLICACIÓN
// =====================================================

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState("home");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [courseName, setCourseName] = useState("");
  const [courseColor, setCourseColor] = useState("#e9d8f4");

  const [showEditCourseModal, setShowEditCourseModal] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState(null);
  const [editCourseName, setEditCourseName] = useState("");
  const [editCourseColor, setEditCourseColor] = useState("#e9d8f4");

  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialTopic, setMaterialTopic] = useState("");
  const [materialType, setMaterialType] = useState("Apunte");
  const [selectedFile, setSelectedFile] = useState(null);
  const [savingMaterial, setSavingMaterial] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");
  const [quizDifficulty, setQuizDifficulty] = useState("Medio");
  const [activeFlashcard, setActiveFlashcard] = useState(0);
  const [showFlashcardAnswer, setShowFlashcardAnswer] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      alert("No se pudieron guardar todos los datos del navegador.");
    }
  }, [data]);

  const course = useMemo(
    () => data.courses.find((item) => item.id === selectedCourse) || null,
    [data.courses, selectedCourse]
  );

  const filteredCourses = data.courses.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const courseMaterials = data.materials.filter(
    (item) => item.courseId === selectedCourse
  );

  const courseNotes = data.notes.filter(
    (item) => item.courseId === selectedCourse
  );

  const courseFlashcards = data.flashcards.filter(
    (item) => item.courseId === selectedCourse
  );

  const courseQuestions = data.questions.filter(
    (item) => item.courseId === selectedCourse
  );

  function goToStudyPage(nextPage, courseId = selectedCourse) {
    if (courseId) setSelectedCourse(courseId);
    setAiError("");
    setAiResult("");
    setPage(nextPage);
  }

  function createCourse() {
    if (!courseName.trim()) return;

    const newCourse = {
      id: crypto.randomUUID(),
      name: courseName.trim(),
      color: courseColor,
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      courses: [...current.courses, newCourse],
    }));

    setCourseName("");
    setCourseColor("#e9d8f4");
    setShowCourseModal(false);
    setSelectedCourse(newCourse.id);
    setPage("course");
  }

  function openEditCourse(item) {
    setEditingCourseId(item.id);
    setEditCourseName(item.name);
    setEditCourseColor(item.color);
    setShowEditCourseModal(true);
  }

  function saveCourseChanges() {
    if (!editCourseName.trim() || !editingCourseId) return;

    setData((current) => ({
      ...current,
      courses: current.courses.map((item) =>
        item.id === editingCourseId
          ? { ...item, name: editCourseName.trim(), color: editCourseColor }
          : item
      ),
    }));

    setShowEditCourseModal(false);
    setEditingCourseId(null);
  }

  async function deleteCourse(id) {
    if (!window.confirm(
      "¿Seguro que quieres eliminar este curso y todos sus materiales?"
    )) return;

    const ids = data.materials
      .filter((item) => item.courseId === id)
      .map((item) => item.id);

    await Promise.all(ids.map((fileId) => deleteFileData(fileId).catch(() => {})));

    setData((current) => ({
      ...current,
      courses: current.courses.filter((item) => item.id !== id),
      materials: current.materials.filter((item) => item.courseId !== id),
      notes: current.notes.filter((item) => item.courseId !== id),
      flashcards: current.flashcards.filter((item) => item.courseId !== id),
      questions: current.questions.filter((item) => item.courseId !== id),
      summaries: current.summaries.filter((item) => item.courseId !== id),
    }));

    if (selectedCourse === id) {
      setSelectedCourse(null);
      setPage("home");
    }
  }

  async function addMaterial() {
    if (!course || !selectedFile) {
      alert("Selecciona un archivo primero.");
      return;
    }

    setSavingMaterial(true);

    try {
      const file = selectedFile;
      const text = await extractFileText(file);
      const id = crypto.randomUUID();

      await saveFileData(id, file, text);

      const newMaterial = {
        id,
        courseId: course.id,
        title: materialTitle.trim() || file.name,
        topic: materialTopic.trim() || "Sin clasificar",
        type: materialType,
        fileName: file.name,
        fileType: file.type,
        textLength: text.length,
        createdAt: new Date().toISOString(),
      };

      setData((current) => ({
        ...current,
        materials: [...current.materials, newMaterial],
      }));

      setMaterialTitle("");
      setMaterialTopic("");
      setMaterialType("Apunte");
      setSelectedFile(null);
      setShowMaterialModal(false);

      if (file.type.startsWith("image/")) {
        alert("Imagen guardada. Para que la IA lea su texto, todavía falta incorporar OCR.");
      } else if (!text.trim()) {
        alert("El archivo se guardó, pero no se encontró texto extraíble.");
      } else {
        alert("Material guardado y texto extraído correctamente.");
      }
    } catch (error) {
      alert(error.message || "No se pudo guardar el material.");
    } finally {
      setSavingMaterial(false);
    }
  }

  async function removeMaterial(id) {
    if (!window.confirm("¿Eliminar este material?")) return;

    await deleteFileData(id).catch(() => {});

    setData((current) => ({
      ...current,
      materials: current.materials.filter((item) => item.id !== id),
    }));
  }

  async function openMaterial(material) {
    try {
      const stored = await getFileData(material.id);

      if (!stored?.blob) {
        alert("No se encontró el archivo guardado. Vuelve a subirlo.");
        return;
      }

      const url = URL.createObjectURL(stored.blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      alert("No se pudo abrir el archivo.");
    }
  }

  function addNote(text) {
    if (!course || !text.trim()) return;

    const note = {
      id: crypto.randomUUID(),
      courseId: course.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setData((current) => ({
      ...current,
      notes: [...current.notes, note],
    }));
  }

  async function getCourseText() {
    if (!selectedCourse) {
      throw new Error("Primero selecciona un curso.");
    }

    const materials = data.materials.filter(
      (item) => item.courseId === selectedCourse
    );

    const parts = [];

    for (const material of materials) {
      const stored = await getFileData(material.id);
      if (stored?.text?.trim()) {
        parts.push(
          `MATERIAL: ${material.title}\nTEMA: ${material.topic}\n${stored.text}`
        );
      }
    }

    const notes = data.notes.filter(
      (item) => item.courseId === selectedCourse
    );

    for (const note of notes) {
      parts.push(`NOTA DEL CURSO:\n${note.text}`);
    }

    return parts.join("\n\n---\n\n").slice(0, 30000);
  }

  async function runAI(action, question = "") {
    setAiLoading(true);
    setAiError("");
    setAiResult("");

    try {
      const text = await getCourseText();
      const result = await callStudyBloomAI(action, text, question);
      setAiResult(result);

      if (action === "summary") {
        setData((current) => ({
          ...current,
          summaries: [
            {
              id: crypto.randomUUID(),
              courseId: selectedCourse,
              text: result,
              createdAt: new Date().toISOString(),
            },
            ...current.summaries,
          ],
        }));
      }

      if (action === "quiz") {
        setData((current) => ({
          ...current,
          questions: [
            ...current.questions,
            {
              id: crypto.randomUUID(),
              courseId: selectedCourse,
              text: result,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }

      if (action === "flashcards") {
        setData((current) => ({
          ...current,
          flashcards: [
            ...current.flashcards,
            {
              id: crypto.randomUUID(),
              courseId: selectedCourse,
              text: result,
              createdAt: new Date().toISOString(),
            },
          ],
        }));
      }
    } catch (error) {
      setAiError(error.message || "Ocurrió un error al generar el contenido.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-button mobile-menu" onClick={() => setMenuOpen(!menuOpen)}>
          <Menu size={21} />
        </button>

        <button className="brand" onClick={() => { setPage("home"); setSelectedCourse(null); }}>
          <div className="brand-icon"><Brain size={22} /></div>
          <div>
            <strong>StudyBloom</strong>
            <span>Tu espacio para aprender</span>
          </div>
        </button>

        <div className="search">
          <Search size={18} />
          <input
            placeholder="Buscar cursos..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <button className="profile" onClick={() => setPage("profile")}>
          {data.profile.name ? data.profile.name.charAt(0).toUpperCase() : "♡"}
        </button>
      </header>

      <div className="layout">
        <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
          <nav>
            <NavItem icon={<Sparkles size={19} />} text="Inicio" active={page === "home"} onClick={() => { setPage("home"); setMenuOpen(false); }} />
            <NavItem icon={<BookOpen size={19} />} text="Mis cursos" active={page === "courses" || page === "course"} onClick={() => { setPage("courses"); setMenuOpen(false); }} />
            <NavItem icon={<Brain size={19} />} text="Estudiar" active={page === "study"} onClick={() => { setPage("study"); setMenuOpen(false); }} />
            <NavItem icon={<Target size={19} />} text="Cuestionarios" active={page === "quizzes"} onClick={() => { setPage("quizzes"); setMenuOpen(false); }} />
            <NavItem icon={<Lightbulb size={19} />} text="Flashcards" active={page === "flashcards"} onClick={() => { setPage("flashcards"); setMenuOpen(false); }} />
            <NavItem icon={<CalendarDays size={19} />} text="Plan de estudio" active={page === "planner"} onClick={() => { setPage("planner"); setMenuOpen(false); }} />
          </nav>

          <div className="sidebar-bottom">
            <div className="little-card">
              <Heart size={17} />
              <div>
                <strong>Estudia a tu ritmo</strong>
                <span>Pequeños pasos también cuentan.</span>
              </div>
            </div>
          </div>
        </aside>

        <main className="content">
          {page === "home" && (
            <Home
              data={data}
              setPage={setPage}
              setShowCourseModal={setShowCourseModal}
              setSelectedCourse={setSelectedCourse}
              onEditCourse={openEditCourse}
            />
          )}

          {page === "courses" && (
            <Courses
              courses={filteredCourses}
              data={data}
              setSelectedCourse={setSelectedCourse}
              setPage={setPage}
              setShowCourseModal={setShowCourseModal}
              deleteCourse={deleteCourse}
              onEditCourse={openEditCourse}
            />
          )}

          {page === "course" && course && (
            <CoursePage
              course={course}
              data={data}
              setPage={setPage}
              setShowMaterialModal={setShowMaterialModal}
              addNote={addNote}
              removeMaterial={removeMaterial}
              openMaterial={openMaterial}
              onEditCourse={openEditCourse}
            />
          )}

          {page === "study" && (
            <StudyPage
              data={data}
              course={course}
              selectedCourse={selectedCourse}
              setSelectedCourse={setSelectedCourse}
              runAI={runAI}
              aiLoading={aiLoading}
              aiError={aiError}
              aiResult={aiResult}
              aiQuestion={aiQuestion}
              setAiQuestion={setAiQuestion}
            />
          )}

          {page === "quizzes" && (
            <QuizPage
              data={data}
              selectedCourse={selectedCourse}
              setSelectedCourse={setSelectedCourse}
              runAI={runAI}
              aiLoading={aiLoading}
              aiError={aiError}
              aiResult={aiResult}
              difficulty={quizDifficulty}
              setDifficulty={setQuizDifficulty}
            />
          )}

          {page === "flashcards" && (
            <FlashcardsPage
              data={data}
              selectedCourse={selectedCourse}
              setSelectedCourse={setSelectedCourse}
              runAI={runAI}
              aiLoading={aiLoading}
              aiError={aiError}
              aiResult={aiResult}
              activeFlashcard={activeFlashcard}
              setActiveFlashcard={setActiveFlashcard}
              showFlashcardAnswer={showFlashcardAnswer}
              setShowFlashcardAnswer={setShowFlashcardAnswer}
            />
          )}

          {page === "planner" && <PlannerPage />}

          {page === "profile" && <ProfilePage data={data} setData={setData} />}
        </main>
      </div>

      {showCourseModal && (
        <Modal title="Crear un nuevo curso" close={() => setShowCourseModal(false)}>
          <div className="form">
            <label>
              Nombre del curso
              <input autoFocus placeholder="Ej. Psicología social" value={courseName} onChange={(event) => setCourseName(event.target.value)} />
            </label>
            <label>
              Color del curso
              <input type="color" value={courseColor} onChange={(event) => setCourseColor(event.target.value)} />
            </label>
            <div className="edit-course-preview" style={{ background: courseColor }}>
              <BookOpen size={25} />
              <strong>{courseName || "Nombre del curso"}</strong>
            </div>
            <button className="primary-button" onClick={createCourse} disabled={!courseName.trim()}>
              <Plus size={18} /> Crear curso
            </button>
          </div>
        </Modal>
      )}

      {showEditCourseModal && (
        <Modal title="Editar curso" close={() => setShowEditCourseModal(false)}>
          <div className="form">
            <label>
              Nombre del curso
              <input autoFocus value={editCourseName} onChange={(event) => setEditCourseName(event.target.value)} />
            </label>
            <label>
              Color del curso
              <input type="color" value={editCourseColor} onChange={(event) => setEditCourseColor(event.target.value)} />
            </label>
            <div className="edit-course-preview" style={{ background: editCourseColor }}>
              <BookOpen size={25} />
              <strong>{editCourseName || "Nombre del curso"}</strong>
            </div>
            <button className="primary-button" onClick={saveCourseChanges} disabled={!editCourseName.trim()}>
              <Check size={18} /> Guardar cambios
            </button>
          </div>
        </Modal>
      )}

      {showMaterialModal && course && (
        <Modal title="Agregar material" close={() => { setShowMaterialModal(false); setSelectedFile(null); }}>
          <div className="form">
            <label>
              Archivo
              <input
                type="file"
                accept=".pdf,.docx,.pptx,.txt,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file) setMaterialTitle(file.name);
                }}
              />
            </label>
            <p className="helper-text">Formatos compatibles: PDF, DOCX, PPTX y TXT. También puedes guardar imágenes, pero aún no se lee su texto automáticamente.</p>
            <label>
              Nombre
              <input placeholder="Ej. Clase 4" value={materialTitle} onChange={(event) => setMaterialTitle(event.target.value)} />
            </label>
            <label>
              Tema
              <input placeholder="Ej. Memoria" value={materialTopic} onChange={(event) => setMaterialTopic(event.target.value)} />
            </label>
            <label>
              Tipo
              <select value={materialType} onChange={(event) => setMaterialType(event.target.value)}>
                <option>Apunte</option>
                <option>PDF</option>
                <option>Lectura</option>
                <option>Diapositivas</option>
                <option>Foto</option>
                <option>Otro</option>
              </select>
            </label>
            <button className="primary-button" onClick={addMaterial} disabled={savingMaterial || !selectedFile}>
              <Upload size={18} />
              {savingMaterial ? "Leyendo y guardando..." : "Guardar material"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// =====================================================
// NAVEGACIÓN Y CURSOS
// =====================================================

function NavItem({ icon, text, active, onClick }) {
  return (
    <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>
      {icon}<span>{text}</span>
    </button>
  );
}

function Home({ data, setPage, setShowCourseModal, setSelectedCourse, onEditCourse }) {
  return (
    <section>
      <div className="hero">
        <div>
          <span className="eyebrow">TU ESPACIO ACADÉMICO 🌷</span>
          <h1>Hola{data.profile.name ? `, ${data.profile.name}` : ""} ♡</h1>
          <p>Organiza tus cursos, guarda tus materiales y convierte todo lo que estudias en conocimiento.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => setShowCourseModal(true)}><Plus size={18} /> Crear curso</button>
            <button className="secondary-button" onClick={() => setPage("study")}><Brain size={18} /> Empezar a estudiar</button>
          </div>
        </div>
        <div className="hero-art"><div className="flower">✿</div><Brain size={75} /></div>
      </div>

      <div className="section-header">
        <div><h2>Tu espacio de estudio</h2><p>Todo organizado en un solo lugar.</p></div>
      </div>

      <div className="stats">
        <Stat icon={<BookOpen />} number={data.courses.length} label="Cursos" />
        <Stat icon={<FileText />} number={data.materials.length} label="Materiales" />
        <Stat icon={<Target />} number={data.questions.length} label="Cuestionarios" />
        <Stat icon={<Lightbulb />} number={data.flashcards.length} label="Flashcards" />
      </div>

      <div className="section-header">
        <div><h2>Mis cursos</h2><p>Continúa donde lo dejaste.</p></div>
        {data.courses.length > 0 && <button className="text-button" onClick={() => setPage("courses")}>Ver todos <ChevronRight size={16} /></button>}
      </div>

      {data.courses.length === 0 ? (
        <EmptyState icon={<BookOpen size={32} />} title="Todavía no tienes cursos" text="Crea tu primer curso y empieza a construir tu espacio académico." button="Crear mi primer curso" onClick={() => setShowCourseModal(true)} />
      ) : (
        <div className="course-grid">
          {data.courses.slice(0, 4).map((item) => (
            <CourseCard
              key={item.id}
              course={item}
              materials={data.materials.filter((material) => material.courseId === item.id).length}
              onClick={() => { setSelectedCourse(item.id); setPage("course"); }}
              onEdit={() => onEditCourse(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Courses({ courses, data, setSelectedCourse, setPage, setShowCourseModal, deleteCourse, onEditCourse }) {
  return (
    <section>
      <PageTitle eyebrow="ORGANIZACIÓN" title="Mis cursos" text="Cada curso tiene su propio espacio de estudio.">
        <button className="primary-button" onClick={() => setShowCourseModal(true)}><Plus size={18} /> Nuevo curso</button>
      </PageTitle>
      {courses.length === 0 ? (
        <EmptyState icon={<BookOpen size={32} />} title="No encontramos cursos" text="Crea uno para empezar." button="Crear curso" onClick={() => setShowCourseModal(true)} />
      ) : (
        <div className="course-grid large">
          {courses.map((item) => (
            <CourseCard
              key={item.id}
              course={item}
              materials={data.materials.filter((material) => material.courseId === item.id).length}
              onClick={() => { setSelectedCourse(item.id); setPage("course"); }}
              onEdit={() => onEditCourse(item)}
              onDelete={() => deleteCourse(item.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CourseCard({ course, materials = 0, onClick, onDelete, onEdit }) {
  return (
    <article className="course-card">
      <button className="course-main" onClick={onClick}>
        <div className="course-color" style={{ background: course.color }}><BookOpen size={25} /></div>
        <div><h3>{course.name}</h3><p>{materials} {materials === 1 ? "material" : "materiales"}</p></div>
        <ChevronRight size={19} className="arrow" />
      </button>
      <div className="course-card-actions">
        {onEdit && <button className="icon-button" onClick={(event) => { event.stopPropagation(); onEdit(); }} title="Editar curso"><Pencil size={16} /></button>}
        {onDelete && <button className="icon-button" onClick={(event) => { event.stopPropagation(); onDelete(); }} title="Eliminar curso"><Trash2 size={16} /></button>}
      </div>
    </article>
  );
}

// =====================================================
// DETALLE DE CURSO
// =====================================================

function CoursePage({ course, data, setPage, setShowMaterialModal, addNote, removeMaterial, openMaterial, onEditCourse }) {
  const [note, setNote] = useState("");

  const materials = data.materials.filter((item) => item.courseId === course.id);
  const notes = data.notes.filter((item) => item.courseId === course.id);
  const topics = [...new Set(materials.map((item) => item.topic).filter(Boolean))];

  return (
    <section>
      <button className="back-button" onClick={() => setPage("courses")}>← Mis cursos</button>

      <div className="course-header" style={{ background: `linear-gradient(135deg, ${course.color}, #fff8fb)` }}>
        <div className="course-header-icon"><BookOpen size={30} /></div>
        <div className="course-header-info">
          <span className="eyebrow">CURSO</span>
          <h1>{course.name}</h1>
          <p>{materials.length} materiales · {topics.length} temas</p>
        </div>
        <button className="secondary-button course-edit-button" onClick={() => onEditCourse(course)}><Pencil size={17} /> Editar curso</button>
      </div>

      <div className="quick-actions">
        <button className="action-card" onClick={() => setShowMaterialModal(true)}><Upload /><strong>Agregar material</strong><span>PDF, documento o texto</span></button>
        <button className="action-card" onClick={() => setPage("study")}><Brain /><strong>Estudiar</strong><span>Genera un resumen con IA</span></button>
        <button className="action-card" onClick={() => setPage("quizzes")}><Target /><strong>Cuestionario</strong><span>Practica lo aprendido</span></button>
      </div>

      <div className="two-columns">
        <div>
          <SectionTitle title="Materiales" text="Tus archivos de este curso." />
          {materials.length === 0 ? (
            <EmptyState icon={<FileText size={30} />} title="Todavía no hay materiales" text="Sube tus apuntes, PDFs o documentos." button="Agregar material" onClick={() => setShowMaterialModal(true)} />
          ) : (
            <div className="material-list">
              {materials.map((material) => (
                <div className="material-item" key={material.id}>
                  <div className="material-icon"><FileText size={20} /></div>
                  <div className="material-info">
                    <strong>{material.title}</strong>
                    <span>{material.topic} · {material.type}</span>
                    <span>{material.textLength ? `${material.textLength.toLocaleString()} caracteres extraídos` : "Sin texto extraído"}</span>
                  </div>
                  <button className="icon-button" title="Abrir archivo" onClick={() => openMaterial(material)}><FileText size={16} /></button>
                  <button className="icon-button" title="Eliminar material" onClick={() => removeMaterial(material.id)}><Trash2 size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle title="Mis notas" text="Ideas, recordatorios y dudas." />
          <div className="note-box">
            <textarea placeholder="Escribe algo que quieras recordar..." value={note} onChange={(event) => setNote(event.target.value)} />
            <button className="primary-button" onClick={() => { addNote(note); setNote(""); }}>Guardar nota</button>
          </div>
          <div className="notes-list">
            {notes.map((item) => <div className="note" key={item.id}><span>{item.text}</span></div>)}
          </div>
        </div>
      </div>
    </section>
  );
}

// =====================================================
// SELECTOR DE CURSO Y RESULTADOS DE IA
// =====================================================

function CourseSelector({ data, selectedCourse, setSelectedCourse }) {
  return (
    <label className="ai-course-selector">
      Curso para estudiar
      <select value={selectedCourse || ""} onChange={(event) => setSelectedCourse(event.target.value || null)}>
        <option value="">Selecciona un curso</option>
        {data.courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
    </label>
  );
}

function AIResult({ result, error, loading }) {
  return (
    <>
      {loading && <div className="future-box"><Sparkles size={25} /><div><h3>StudyBloom está trabajando…</h3><p>Estamos analizando los materiales del curso.</p></div></div>}
      {error && <div className="ai-error" role="alert">{error}</div>}
      {result && <div className="ai-result"><div className="section-title"><h2>Resultado</h2><p>Contenido generado a partir de los materiales del curso seleccionado.</p></div><pre>{result}</pre><button className="secondary-button" onClick={() => navigator.clipboard?.writeText(result)}>Copiar resultado</button></div>}
    </>
  );
}

// =====================================================
// ESTUDIAR
// =====================================================

function StudyPage({ data, course, selectedCourse, setSelectedCourse, runAI, aiLoading, aiError, aiResult, aiQuestion, setAiQuestion }) {
  return (
    <section>
      <PageTitle eyebrow="MODO ESTUDIO" title="¿Qué quieres estudiar?" text="Genera materiales de repaso a partir de tus propios documentos." />
      <CourseSelector data={data} selectedCourse={selectedCourse} setSelectedCourse={setSelectedCourse} />

      <div className="study-grid">
        <button className="study-card" disabled={!selectedCourse || aiLoading} onClick={() => runAI("summary")}>
          <div className="study-icon"><FileText /></div><h3>Generar resumen</h3><p>Identifica conceptos clave y explica las ideas principales de tus apuntes.</p><span className="primary-button">{aiLoading ? "Procesando…" : "Crear resumen"}</span>
        </button>
        <button className="study-card" disabled={!selectedCourse || aiLoading} onClick={() => runAI("flashcards")}>
          <div className="study-icon"><Lightbulb /></div><h3>Crear flashcards</h3><p>Genera tarjetas de pregunta y respuesta para memorizar conceptos.</p><span className="primary-button">Crear tarjetas</span>
        </button>
        <button className="study-card" disabled={!selectedCourse || aiLoading} onClick={() => runAI("quiz", "Crea preguntas de práctica con sus respuestas y explicaciones.")}>
          <div className="study-icon"><Target /></div><h3>Practicar preguntas</h3><p>Entrena tu comprensión con preguntas basadas en tus materiales.</p><span className="primary-button">Practicar</span>
        </button>
      </div>

      <div className="quiz-builder">
        <div className="quiz-icon"><Brain size={32} /></div>
        <h2>Pregúntale a tus apuntes</h2>
        <p>Haz una pregunta sobre el contenido del curso seleccionado.</p>
        <textarea placeholder="Ej. ¿Cuál es la diferencia entre memoria episódica y semántica?" value={aiQuestion} onChange={(event) => setAiQuestion(event.target.value)} />
        <button className="primary-button" disabled={!selectedCourse || !aiQuestion.trim() || aiLoading} onClick={() => runAI("ask", aiQuestion)}>
          <Sparkles size={18} /> Preguntar a la IA
        </button>
      </div>
      <AIResult result={aiResult} error={aiError} loading={aiLoading} />
    </section>
  );
}

// =====================================================
// CUESTIONARIOS
// =====================================================

function QuizPage({ data, selectedCourse, setSelectedCourse, runAI, aiLoading, aiError, aiResult, difficulty, setDifficulty }) {
  return (
    <section>
      <PageTitle eyebrow="PRÁCTICA" title="Cuestionarios" text="Crea ejercicios a partir de tus materiales." />
      <CourseSelector data={data} selectedCourse={selectedCourse} setSelectedCourse={setSelectedCourse} />
      <div className="quiz-builder">
        <div className="quiz-icon"><Target size={32} /></div>
        <h2>Crear cuestionario</h2>
        <p>Selecciona la dificultad y genera preguntas basadas en el material del curso.</p>
        <div className="difficulty">
          {["Fácil", "Medio", "Difícil", "Examen"].map((item) => (
            <button key={item} className={difficulty === item ? "selected" : ""} onClick={() => setDifficulty(item)}>{item}</button>
          ))}
        </div>
        <button className="primary-button" disabled={!selectedCourse || aiLoading} onClick={() => runAI("quiz", `Genera un cuestionario de nivel ${difficulty}. Incluye preguntas, opciones cuando corresponda, respuestas correctas y explicaciones. Basa todo en los materiales proporcionados.`)}>
          <Sparkles size={18} /> {aiLoading ? "Generando…" : "Preparar cuestionario"}
        </button>
      </div>
      <AIResult result={aiResult} error={aiError} loading={aiLoading} />
    </section>
  );
}

// =====================================================
// FLASHCARDS
// =====================================================

function FlashcardsPage({ data, selectedCourse, setSelectedCourse, runAI, aiLoading, aiError, aiResult, activeFlashcard, setActiveFlashcard, showFlashcardAnswer, setShowFlashcardAnswer }) {
  const savedDecks = data.flashcards.filter((item) => item.courseId === selectedCourse);
  const currentDeck = savedDecks[savedDecks.length - 1];

  return (
    <section>
      <PageTitle eyebrow="MEMORIZACIÓN" title="Flashcards" text="Convierte los conceptos importantes en tarjetas de repaso." />
      <CourseSelector data={data} selectedCourse={selectedCourse} setSelectedCourse={setSelectedCourse} />
      <div className="quiz-builder">
        <div className="quiz-icon"><Lightbulb size={32} /></div>
        <h2>Generar flashcards</h2>
        <p>La IA preparará preguntas y respuestas basadas en tus apuntes.</p>
        <button className="primary-button" disabled={!selectedCourse || aiLoading} onClick={() => runAI("flashcards", "Genera 10 flashcards concisas. Cada tarjeta debe tener una pregunta o concepto y una respuesta breve. Devuelve el resultado en una lista numerada claramente separada.")}>
          <Sparkles size={18} /> {aiLoading ? "Generando…" : "Crear flashcards"}
        </button>
      </div>

      {currentDeck && (
        <div className="ai-result">
          <h2>Último conjunto generado</h2>
          <pre>{currentDeck.text}</pre>
        </div>
      )}
      <AIResult result={aiResult} error={aiError} loading={aiLoading} />
      {savedDecks.length > 1 && (
        <div className="notes-list">
          <h3>Conjuntos anteriores</h3>
          {savedDecks.slice(0, -1).map((deck) => <div className="note" key={deck.id}><span>{deck.text.slice(0, 180)}…</span></div>)}
        </div>
      )}
    </section>
  );
}

// =====================================================
// PLANIFICADOR
// =====================================================

function PlannerPage() {
  return (
    <section>
      <PageTitle eyebrow="ORGANIZACIÓN" title="Plan de estudio" text="Organiza tus sesiones y prepara tus exámenes." />
      <div className="planner">
        {["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"].map((day) => (
          <div className="day" key={day}><strong>{day}</strong><span>Sin sesiones programadas</span></div>
        ))}
      </div>
    </section>
  );
}

// =====================================================
// PERFIL
// =====================================================

function ProfilePage({ data, setData }) {
  const [name, setName] = useState(data.profile.name);

  function save() {
    setData((current) => ({ ...current, profile: { ...current.profile, name } }));
  }

  return (
    <section>
      <PageTitle eyebrow="PERSONALIZACIÓN" title="Mi perfil" text="Haz que StudyBloom se sienta como tu propio espacio." />
      <div className="profile-card">
        <div className="avatar-large">{name ? name.charAt(0).toUpperCase() : "♡"}</div>
        <label>Tu nombre<input placeholder="Escribe tu nombre" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <button className="primary-button" onClick={save}><Check size={18} /> Guardar</button>
      </div>
    </section>
  );
}

// =====================================================
// COMPONENTES COMPARTIDOS
// =====================================================

function Stat({ icon, number, label }) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><strong>{number}</strong><span>{label}</span></div></div>;
}

function PageTitle({ eyebrow, title, text, children }) {
  return <div className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{text}</p></div>{children}</div>;
}

function SectionTitle({ title, text }) {
  return <div className="section-title"><h2>{title}</h2><p>{text}</p></div>;
}

function EmptyState({ icon, title, text, button, onClick }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <h3>{title}</h3><p>{text}</p>
      {button && <button className="primary-button" onClick={onClick}><Plus size={18} />{button}</button>}
    </div>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="modal-background" onMouseDown={close}>
      <div className="modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={close}><X size={20} /></button></div>
        {children}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
