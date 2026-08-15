import { createAdminRouter } from "../../server/vercel-api/admin-router.js";
import courseEnrollments from "../../server/vercel-api/admin/course-enrollments.js";
import courseEnrollmentById from "../../server/vercel-api/admin/course-enrollments/[id].js";
import courses from "../../server/vercel-api/admin/courses.js";
import courseById from "../../server/vercel-api/admin/courses/[id].js";
import dbStatus from "../../server/vercel-api/admin/db-status.js";
import labRentals from "../../server/vercel-api/admin/lab-rentals.js";
import labRentalById from "../../server/vercel-api/admin/lab-rentals/[id].js";
import labs from "../../server/vercel-api/admin/labs.js";
import labById from "../../server/vercel-api/admin/labs/[id].js";
import orders from "../../server/vercel-api/admin/orders.js";
import students from "../../server/vercel-api/admin/students.js";
import teamMembers from "../../server/vercel-api/admin/team-members.js";
import teamMemberById from "../../server/vercel-api/admin/team-members/[id].js";
import upload from "../../server/vercel-api/admin/upload.js";
import uploadTeamPhoto from "../../server/vercel-api/admin/upload-team-photo.js";
import verify from "../../server/vercel-api/admin/verify.js";

const route = (pattern, methods, handler) => ({ pattern, methods: new Set([...methods, "OPTIONS"]), handler });

export const ADMIN_ROUTES = [
  route(/^course-enrollments$/, ["GET", "POST"], courseEnrollments),
  route(/^course-enrollments\/([^/]+)$/, ["PATCH"], courseEnrollmentById),
  route(/^courses$/, ["GET", "POST"], courses),
  route(/^courses\/([^/]+)$/, ["PUT", "DELETE"], courseById),
  route(/^db-status$/, ["GET"], dbStatus),
  route(/^lab-rentals$/, ["GET", "POST"], labRentals),
  route(/^lab-rentals\/([^/]+)$/, ["PATCH"], labRentalById),
  route(/^labs$/, ["GET", "POST"], labs),
  route(/^labs\/([^/]+)$/, ["PUT", "DELETE"], labById),
  route(/^orders$/, ["GET"], orders),
  route(/^students$/, ["GET"], students),
  route(/^team-members$/, ["GET", "POST"], teamMembers),
  route(/^team-members\/([^/]+)$/, ["PUT", "DELETE"], teamMemberById),
  route(/^upload$/, ["POST"], upload),
  route(/^upload-team-photo$/, ["POST"], uploadTeamPhoto),
  route(/^verify$/, ["POST"], verify),
];

export default createAdminRouter(ADMIN_ROUTES);
