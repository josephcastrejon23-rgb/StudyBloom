import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BookOpen,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Heart,
  ImagePlus,
  Lightbulb,
  Menu,
  Plus,
  Search,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X
} from "lucide-react";

import "./styles.css";

const STORAGE_KEY = "studybloom-data";

const starterData = {
  profile: {
    name: ""
  },
  courses: [],
  materials: [],
  notes: [],
  flashcards: [],
  questions: []
};

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return starterData;

    return {
      ...starterData,
      ...JSON.parse(saved)
    };
  } catch {
    return starterData;
  }
}

function App() {
  const [data, setData] = useState(loadData);
  const [page, setPage] = useState("home");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [search, setSearch] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const [showCourseModal, setShowCourseModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);

  const [courseName, setCourseName] = useState("");
  const [courseColor, setCourseColor] = useState("#e9d8f4");

  const [materialTitle, setMaterialTitle] = useState("");
  const [materialTopic, setMaterialTopic] = useState("");
  const [materialType, setMaterialType] = useState("Apunte");

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  const course = useMemo(
    () =>
      data.courses.find((item) => item.id === selectedCourse) || null,
    [data.courses, selectedCourse]
  );

  const filteredCourses = data.courses.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  function createCourse() {
    if (!courseName.trim()) return;

    const newCourse = {
      id: crypto.randomUUID(),
      name: courseName.trim(),
      color: courseColor,
      createdAt: new Date().toISOString()
    };

    setData((current) => ({
      ...current,
      courses: [...current.courses, newCourse]
    }));

    setCourseName("");
    setCourseColor("#e9d8f4");
    setShowCourseModal(false);

    setSelectedCourse(newCourse.id);
    setPage("course");
  }

  function deleteCourse(id) {
    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar este curso?"
    );

    if (!confirmed) return;

    setData((current) => ({
      ...current,
      courses: current.courses.filter((course) => course.id !== id),
      materials: current.materials.filter(
        (material) => material.courseId !== id
      ),
      notes: current.notes.filter((note) => note.courseId !== id),
      flashcards: current.flashcards.filter(
        (card) => card.courseId !== id
      ),
      questions: current.questions.filter(
        (question) => question.courseId !== id
      )
    }));

    if (selectedCourse === id) {
      setSelectedCourse(null);
      setPage("home");
    }
  }

  function addMaterial(file) {
    if (!course || !file) return;

    const newMaterial = {
      id: crypto.randomUUID(),
      courseId: course.id,
      title: materialTitle.trim() || file.name,
      topic: materialTopic.trim() || "Sin clasificar",
      type: materialType,
      fileName: file.name,
      fileType: file.type,
      createdAt: new Date().toISOString()
    };

    setData((current) => ({
      ...current,
      materials: [...current.materials, newMaterial]
    }));

    setMaterialTitle("");
    setMaterialTopic("");
    setMaterialType("Apunte");
    setShowMaterialModal(false);
  }

  function addNote(text) {
    if (!course || !text.trim()) return;

    const note = {
      id: crypto.randomUUID(),
      courseId: course.id,
      text: text.trim(),
      createdAt: new Date().toISOString()
    };

    setData((current) => ({
      ...current,
      notes: [...current.notes, note]
    }));
  }

  function removeMaterial(id) {
    setData((current) => ({
      ...current,
      materials: current.materials.filter(
        (material) => material.id !== id
      )
    }));
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <Menu size={21} />
        </button>

        <button
          className="brand"
          onClick={() => {
            setPage("home");
            setSelectedCourse(null);
          }}
        >
          <div className="brand-icon">
            <Brain size={22} />
          </div>

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

        <button
          className="profile"
          onClick={() => setPage("profile")}
        >
          {data.profile.name
            ? data.profile.name.charAt(0).toUpperCase()
            : "♡"}
        </button>
      </header>

      <div className="layout">
        <aside className={`sidebar ${menuOpen ? "open" : ""}`}>
          <nav>
            <NavItem
              icon={<Sparkles size={19} />}
              text="Inicio"
              active={page === "home"}
              onClick={() => {
                setPage("home");
                setMenuOpen(false);
              }}
            />

            <NavItem
              icon={<BookOpen size={19} />}
              text="Mis cursos"
              active={page === "courses"}
              onClick={() => {
                setPage("courses");
                setMenuOpen(false);
              }}
            />

            <NavItem
              icon={<Brain size={19} />}
              text="Estudiar"
              active={page === "study"}
              onClick={() => {
                setPage("study");
                setMenuOpen(false);
              }}
            />

            <NavItem
              icon={<Target size={19} />}
              text="Cuestionarios"
              active={page === "quizzes"}
              onClick={() => {
                setPage("quizzes");
                setMenuOpen(false);
              }}
            />

            <NavItem
              icon={<Lightbulb size={19} />}
              text="Flashcards"
              active={page === "flashcards"}
              onClick={() => {
                setPage("flashcards");
                setMenuOpen(false);
              }}
            />

            <NavItem
              icon={<CalendarDays size={19} />}
              text="Plan de estudio"
              active={page === "planner"}
              onClick={() => {
                setPage("planner");
                setMenuOpen(false);
              }}
            />
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
            />
          )}

          {page === "courses" && (
            <Courses
              courses={filteredCourses}
              setSelectedCourse={setSelectedCourse}
              setPage={setPage}
              setShowCourseModal={setShowCourseModal}
              deleteCourse={deleteCourse}
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
            />
          )}

          {page === "study" && (
            <StudyPage data={data} setPage={setPage} />
          )}

          {page === "quizzes" && (
            <QuizPage data={data} setPage={setPage} />
          )}

          {page === "flashcards" && (
            <FlashcardsPage data={data} />
          )}

          {page === "planner" && (
            <PlannerPage />
          )}

          {page === "profile" && (
            <ProfilePage
              data={data}
              setData={setData}
            />
          )}
        </main>
      </div>

      {showCourseModal && (
        <Modal
          title="Crear un nuevo curso"
          close={() => setShowCourseModal(false)}
        >
          <div className="form">
            <label>
              Nombre del curso
              <input
                autoFocus
                placeholder="Ej. Psicología social"
                value={courseName}
                onChange={(event) =>
                  setCourseName(event.target.value)
                }
              />
            </label>

            <label>
              Color del curso
              <input
                type="color"
                value={courseColor}
                onChange={(event) =>
                  setCourseColor(event.target.value)
                }
              />
            </label>

            <button
              className="primary-button"
              onClick={createCourse}
            >
              Crear curso
            </button>
          </div>
        </Modal>
      )}

      {showMaterialModal && course && (
        <Modal
          title="Agregar material"
          close={() => setShowMaterialModal(false)}
        >
          <div className="form">
            <label>
              Archivo
              <input
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    setMaterialTitle(file.name);
                  }

                  event.currentTarget.selectedFile =
                    file || null;
                }}
              />
            </label>

            <label>
              Nombre
              <input
                placeholder="Ej. Clase 4"
                value={materialTitle}
                onChange={(event) =>
                  setMaterialTitle(event.target.value)
                }
              />
            </label>

            <label>
              Tema
              <input
                placeholder="Ej. Memoria"
                value={materialTopic}
                onChange={(event) =>
                  setMaterialTopic(event.target.value)
                }
              />
            </label>

            <label>
              Tipo
              <select
                value={materialType}
                onChange={(event) =>
                  setMaterialType(event.target.value)
                }
              >
                <option>Apunte</option>
                <option>PDF</option>
                <option>Lectura</option>
                <option>Diapositivas</option>
                <option>Foto</option>
                <option>Otro</option>
              </select>
            </label>

            <button
              className="primary-button"
              onClick={(event) => {
                const input =
                  event.currentTarget.parentElement.querySelector(
                    'input[type="file"]'
                  );

                const file = input?.files?.[0];

                if (!file) {
                  alert("Selecciona un archivo primero.");
                  return;
                }

                addMaterial(file);
              }}
            >
              Guardar material
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function NavItem({ icon, text, active, onClick }) {
  return (
    <button
      className={`nav-item ${active ? "active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}

function Home({
  data,
  setPage,
  setShowCourseModal,
  setSelectedCourse
}) {
  const totalMaterials = data.materials.length;

  return (
    <section>
      <div className="hero">
        <div>
          <span className="eyebrow">TU ESPACIO ACADÉMICO 🌷</span>

          <h1>
            Hola
            {data.profile.name
              ? `, ${data.profile.name}`
              : ""}{" "}
            ♡
          </h1>

          <p>
            Organiza tus cursos, guarda tus materiales y
            convierte todo lo que estudias en conocimiento.
          </p>

          <div className="hero-actions">
            <button
              className="primary-button"
              onClick={() => setShowCourseModal(true)}
            >
              <Plus size={18} />
              Crear curso
            </button>

            <button
              className="secondary-button"
              onClick={() => setPage("study")}
            >
              <Brain size={18} />
              Empezar a estudiar
            </button>
          </div>
        </div>

        <div className="hero-art">
          <div className="flower">✿</div>
          <Brain size={75} />
        </div>
      </div>

      <div className="section-header">
        <div>
          <h2>Tu espacio de estudio</h2>
          <p>Todo organizado en un solo lugar.</p>
        </div>
      </div>

      <div className="stats">
        <Stat
          icon={<BookOpen />}
          number={data.courses.length}
          label="Cursos"
        />

        <Stat
          icon={<FileText />}
          number={totalMaterials}
          label="Materiales"
        />

        <Stat
          icon={<Target />}
          number={data.questions.length}
          label="Preguntas"
        />

        <Stat
          icon={<Lightbulb />}
          number={data.flashcards.length}
          label="Flashcards"
        />
      </div>

      <div className="section-header">
        <div>
          <h2>Mis cursos</h2>
          <p>Continúa donde lo dejaste.</p>
        </div>

        {data.courses.length > 0 && (
          <button
            className="text-button"
            onClick={() => setPage("courses")}
          >
            Ver todos <ChevronRight size={16} />
          </button>
        )}
      </div>

      {data.courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="Todavía no tienes cursos"
          text="Crea tu primer curso y empieza a construir tu espacio académico."
          button="Crear mi primer curso"
          onClick={() => setShowCourseModal(true)}
        />
      ) : (
        <div className="course-grid">
          {data.courses.slice(0, 4).map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              materials={
                data.materials.filter(
                  (item) => item.courseId === course.id
                ).length
              }
              onClick={() => {
                setSelectedCourse(course.id);
                setPage("course");
              }}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Courses({
  courses,
  setSelectedCourse,
  setPage,
  setShowCourseModal,
  deleteCourse
}) {
  return (
    <section>
      <PageTitle
        eyebrow="ORGANIZACIÓN"
        title="Mis cursos"
        text="Cada curso tiene su propio espacio de estudio."
      >
        <button
          className="primary-button"
          onClick={() => setShowCourseModal(true)}
        >
          <Plus size={18} />
          Nuevo curso
        </button>
      </PageTitle>

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={32} />}
          title="No encontramos cursos"
          text="Crea uno para empezar."
          button="Crear curso"
          onClick={() => setShowCourseModal(true)}
        />
      ) : (
        <div className="course-grid large">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onClick={() => {
                setSelectedCourse(course.id);
                setPage("course");
              }}
              onDelete={() => deleteCourse(course.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function CourseCard({
  course,
  materials = 0,
  onClick,
  onDelete
}) {
  return (
    <article className="course-card">
      <button className="course-main" onClick={onClick}>
        <div
          className="course-color"
          style={{ background: course.color }}
        >
          <BookOpen size={25} />
        </div>

        <div>
          <h3>{course.name}</h3>
          <p>
            {materials} {materials === 1 ? "material" : "materiales"}
          </p>
        </div>

        <ChevronRight size={19} className="arrow" />
      </button>

      {onDelete && (
        <button
          className="delete-course"
          onClick={onDelete}
          title="Eliminar curso"
        >
          <Trash2 size={16} />
        </button>
      )}
    </article>
  );
}

function CoursePage({
  course,
  data,
  setPage,
  setShowMaterialModal,
  addNote,
  removeMaterial
}) {
  const [note, setNote] = useState("");

  const materials = data.materials.filter(
    (item) => item.courseId === course.id
  );

  const notes = data.notes.filter(
    (item) => item.courseId === course.id
  );

  const topics = [
    ...new Set(
      materials.map((item) => item.topic).filter(Boolean)
    )
  ];

  return (
    <section>
      <button
        className="back-button"
        onClick={() => setPage("courses")}
      >
        ← Mis cursos
      </button>

      <div
        className="course-header"
        style={{
          background: `linear-gradient(135deg, ${course.color}, #fff8fb)`
        }}
      >
        <div className="course-header-icon">
          <BookOpen size={30} />
        </div>

        <div>
          <span className="eyebrow">CURSO</span>
          <h1>{course.name}</h1>
          <p>
            {materials.length} materiales · {topics.length} temas
          </p>
        </div>
      </div>

      <div className="quick-actions">
        <button
          className="action-card"
          onClick={() => setShowMaterialModal(true)}
        >
          <Upload />
          <strong>Agregar material</strong>
          <span>PDF, foto, documento...</span>
        </button>

        <button
          className="action-card"
          onClick={() => setPage("study")}
        >
          <Brain />
          <strong>Estudiar</strong>
          <span>Repasa este curso</span>
        </button>

        <button
          className="action-card"
          onClick={() => setPage("quizzes")}
        >
          <Target />
          <strong>Cuestionario</strong>
          <span>Practica lo aprendido</span>
        </button>
      </div>

      <div className="two-columns">
        <div>
          <SectionTitle
            title="Materiales"
            text="Todo lo que has agregado a este curso."
          />

          {materials.length === 0 ? (
            <EmptyState
              icon={<FileText size={30} />}
              title="Todavía no hay materiales"
              text="Sube tus apuntes, PDFs o fotografías."
              button="Agregar material"
              onClick={() => setShowMaterialModal(true)}
            />
          ) : (
            <div className="material-list">
              {materials.map((material) => (
                <div className="material-item" key={material.id}>
                  <div className="material-icon">
                    <FileText size={20} />
                  </div>

                  <div>
                    <strong>{material.title}</strong>
                    <span>
                      {material.topic} · {material.type}
                    </span>
                  </div>

                  <button
                    className="icon-button"
                    onClick={() => removeMaterial(material.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <SectionTitle
            title="Mis notas"
            text="Ideas, recordatorios y dudas."
          />

          <div className="note-box">
            <textarea
              placeholder="Escribe algo que quieras recordar..."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            <button
              className="primary-button"
              onClick={() => {
                addNote(note);
                setNote("");
              }}
            >
              Guardar nota
            </button>
          </div>

          <div className="notes-list">
            {notes.map((item) => (
              <div className="note" key={item.id}>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StudyPage() {
  return (
    <section>
      <PageTitle
        eyebrow="MODO ESTUDIO"
        title="¿Qué quieres estudiar?"
        text="La idea es que StudyBloom te ayude a convertir tus materiales en conocimiento."
      />

      <div className="study-grid">
        <StudyCard
          icon={<FileText />}
          title="Repasar resúmenes"
          text="Revisa los conceptos principales de tus cursos."
        />

        <StudyCard
          icon={<Target />}
          title="Practicar preguntas"
          text="Entrena con preguntas de diferentes niveles."
        />

        <StudyCard
          icon={<Lightbulb />}
          title="Flashcards"
          text="Memoriza conceptos importantes."
        />

        <StudyCard
          icon={<Brain />}
          title="Preguntarle a tus apuntes"
          text="Próximamente podrás conversar con tus materiales."
          soon
        />
      </div>

      <div className="future-box">
        <Sparkles size={28} />

        <div>
          <h3>Tu asistente académico está creciendo ✨</h3>
          <p>
            Próximamente podremos conectar inteligencia
            artificial para leer tus PDFs, fotografías y
            documentos y generar resúmenes, preguntas y
            explicaciones basadas en ellos.
          </p>
        </div>
      </div>
    </section>
  );
}

function QuizPage() {
  const [difficulty, setDifficulty] = useState("Medio");

  return (
    <section>
      <PageTitle
        eyebrow="PRÁCTICA"
        title="Cuestionarios"
        text="Pon a prueba lo que sabes."
      />

      <div className="quiz-builder">
        <div className="quiz-icon">
          <Target size={32} />
        </div>

        <h2>Crear cuestionario</h2>

        <p>
          En la versión inteligente, las preguntas se
          generarán utilizando tus propios materiales.
        </p>

        <div className="difficulty">
          {["Fácil", "Medio", "Difícil", "Examen"].map(
            (item) => (
              <button
                key={item}
                className={
                  difficulty === item ? "selected" : ""
                }
                onClick={() => setDifficulty(item)}
              >
                {item}
              </button>
            )
          )}
        </div>

        <button className="primary-button">
          <Sparkles size={18} />
          Preparar cuestionario
        </button>
      </div>
    </section>
  );
}

function FlashcardsPage() {
  return (
    <section>
      <PageTitle
        eyebrow="MEMORIZACIÓN"
        title="Flashcards"
        text="Repasa conceptos importantes de forma rápida."
      />

      <EmptyState
        icon={<Lightbulb size={32} />}
        title="Todavía no tienes flashcards"
        text="Cuando conectemos el asistente inteligente podrá convertir automáticamente tus apuntes en tarjetas."
      />
    </section>
  );
}

function PlannerPage() {
  return (
    <section>
      <PageTitle
        eyebrow="ORGANIZACIÓN"
        title="Plan de estudio"
        text="Organiza tus sesiones y prepara tus exámenes."
      />

      <div className="planner">
        {[
          "Lunes",
          "Martes",
          "Miércoles",
          "Jueves",
          "Viernes"
        ].map((day) => (
          <div className="day" key={day}>
            <strong>{day}</strong>
            <span>Sin sesiones programadas</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ProfilePage({ data, setData }) {
  const [name, setName] = useState(data.profile.name);

  function save() {
    setData((current) => ({
      ...current,
      profile: {
        ...current.profile,
        name
      }
    }));
  }

  return (
    <section>
      <PageTitle
        eyebrow="PERSONALIZACIÓN"
        title="Mi perfil"
        text="Haz que StudyBloom se sienta como tu propio espacio."
      />

      <div className="profile-card">
        <div className="avatar-large">
          {name ? name.charAt(0).toUpperCase() : "♡"}
        </div>

        <label>
          Tu nombre
          <input
            placeholder="Escribe tu nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>

        <button className="primary-button" onClick={save}>
          <Check size={18} />
          Guardar
        </button>
      </div>
    </section>
  );
}

function StudyCard({ icon, title, text, soon }) {
  return (
    <div className="study-card">
      <div className="study-icon">{icon}</div>

      <h3>{title}</h3>

      <p>{text}</p>

      {soon && <span className="soon">PRÓXIMAMENTE</span>}
    </div>
  );
}

function Stat({ icon, number, label }) {
  return (
    <div className="stat">
      <div className="stat-icon">{icon}</div>

      <div>
        <strong>{number}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function PageTitle({ eyebrow, title, text, children }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>

      {children}
    </div>
  );
}

function SectionTitle({ title, text }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  button,
  onClick
}) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>

      <h3>{title}</h3>

      <p>{text}</p>

      {button && (
        <button className="primary-button" onClick={onClick}>
          <Plus size={18} />
          {button}
        </button>
      )}
    </div>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="modal-background" onMouseDown={close}>
      <div
        className="modal"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{title}</h2>

          <button className="icon-button" onClick={close}>
            <X size={20} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
