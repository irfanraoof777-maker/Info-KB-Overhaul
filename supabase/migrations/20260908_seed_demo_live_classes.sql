BEGIN;
-- DEMO ONLY: remove these rows by slug when replacing them with production classes.
INSERT INTO public.live_courses (slug,title,short_description,description,instructor,price_inr,status,registration_open,featured,duration,timezone)
VALUES
('vmware-vsphere-administration-live-training','VMware vSphere Administration – Live Training','Administer vSphere clusters, virtual machines, storage, and networking with confidence.','Practical, instructor-led vSphere administration training.','Ravi Kumar',4999,'published',true,true,'3 hours','Asia/Kolkata'),
('vmware-esxi-vcenter-fundamentals','VMware ESXi & vCenter Fundamentals','Build a strong virtualization foundation with ESXi hosts and vCenter Server.','Interactive fundamentals class with guided configuration examples.','Anita Sharma',3499,'published',true,true,'2.5 hours','Asia/Kolkata'),
('linux-server-administration-live-workshop','Linux Server Administration – Live Workshop','Practice essential Linux administration, services, storage, and troubleshooting.','Hands-on Linux operations workshop.','Mohammed Irfan',2999,'published',true,true,'3 hours','Asia/Kolkata'),
('backup-disaster-recovery-fundamentals','Backup & Disaster Recovery Fundamentals','Plan reliable backups and recovery workflows for virtual infrastructure.','Live demonstration class covering backup strategy and recovery objectives.','Priya Nair',2499,'published',true,false,'2 hours','Asia/Kolkata'),
('introduction-to-vmware-virtualization','Introduction to VMware Virtualization','A completed introductory class on VMware concepts and architecture.','Archived demo class for completed-state UI testing.','Sandeep Rao',1999,'completed',false,false,'2 hours','Asia/Kolkata')
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.live_course_sessions (live_course_id,session_title,starts_at,ends_at,timezone)
SELECT c.id, s.session_title, s.starts_at, s.ends_at, 'Asia/Kolkata' FROM (VALUES
('vmware-vsphere-administration-live-training','vSphere Administration','2026-10-15 10:00:00+05:30'::timestamptz,'2026-10-15 13:00:00+05:30'::timestamptz),
('vmware-esxi-vcenter-fundamentals','ESXi & vCenter Fundamentals','2026-10-22 11:00:00+05:30'::timestamptz,'2026-10-22 13:30:00+05:30'::timestamptz),
('linux-server-administration-live-workshop','Linux Administration Workshop','2026-10-29 10:00:00+05:30'::timestamptz,'2026-10-29 13:00:00+05:30'::timestamptz),
('backup-disaster-recovery-fundamentals','Backup & DR Live Session','2026-10-08 14:00:00+05:30'::timestamptz,'2026-10-08 16:00:00+05:30'::timestamptz),
('introduction-to-vmware-virtualization','VMware Virtualization Introduction','2026-08-20 10:00:00+05:30'::timestamptz,'2026-08-20 12:00:00+05:30'::timestamptz)
) AS s(slug,session_title,starts_at,ends_at) JOIN public.live_courses c ON c.slug=s.slug
WHERE NOT EXISTS (SELECT 1 FROM public.live_course_sessions existing WHERE existing.live_course_id=c.id AND existing.starts_at=s.starts_at);
COMMIT;
NOTIFY pgrst, 'reload schema';
