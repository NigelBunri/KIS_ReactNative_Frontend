import { API_BASE_URL } from '../config';

const educationRoutes = {
  education: {
    classrooms: API_BASE_URL + "/api/v1/education/classrooms/",
    classroom: (id: string) => API_BASE_URL + "/api/v1/education/classrooms/" + id + "/",
    classroomStart: (id: string) => API_BASE_URL + "/api/v1/education/classrooms/" + id + "/start/",
    classroomEnd: (id: string) => API_BASE_URL + "/api/v1/education/classrooms/" + id + "/end/",
    assignments: API_BASE_URL + "/api/v1/education/assignments/",
    submissions: API_BASE_URL + "/api/v1/education/submissions/",
    scholarships: API_BASE_URL + "/api/v1/education/scholarships/",
    studentBadges: API_BASE_URL + "/api/v1/education/student-badges/",
    transcript: API_BASE_URL + "/api/v1/education/transcript/",
    certificateGenerate: API_BASE_URL + "/api/v1/education/certificates/generate/",
  },
};

export default educationRoutes;
