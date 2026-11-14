export type Role = 'student' | 'school' | 'company' | 'mentor' | 'organization' | 'admin';
export type Level = 'licence' | 'master' | 'doctorat';

export interface User {
  id: number; name: string; email: string; role: Role; status: string;
  country: string | null; institution: string | null; field_of_study: string | null; level: Level | null;
  headline: string | null; bio: string | null; website: string | null; joined_at: string;
}
export interface AuthResponse { message?: string; user: User; token: string | null; expires_at?: string; }

export type WorkType = 'project' | 'thesis' | 'dissertation' | 'publication' | 'portfolio';
export type Visibility = 'public' | 'private';

export interface Work {
  id: number; title: string; abstract: string; theme: string; level: Level; year: number;
  mention: string | null; supervisor: string | null; keywords: string[];
  author_id: number; author_name: string; institution: string | null; views: number; created_at: string;
  type: WorkType; visibility: Visibility; file_name?: string; file_available: boolean;
}
export interface Profile {
  id: number; role: 'student' | 'school'; name: string; country: string | null; headline: string | null;
  bio: string | null; website: string | null; joined_at: string; institution: string | null;
  field_of_study?: string | null; level?: Level | null; profile_visibility?: Visibility;
  highlights?: InstitutionHighlight[];
}
export interface ProfileUpdate {
  name?: string; country?: string; headline?: string; bio?: string; website?: string;
  institution?: string; field_of_study?: string; level?: Level | ''; student_profile_visibility?: Visibility;
  institution_profile_visibility?: Visibility;
}
export interface InstitutionHighlight {
  id: number; student_id: number; student_name: string; title: string; message: string;
}
export interface PublicStudent {
  id: number; name: string; country: string | null; institution: string | null;
  field_of_study: string | null; level: Level | null; headline: string | null;
}
export type ConnectionState = 'none' | 'self' | 'connected' | 'pending_in' | 'pending_out';
export interface Member {
  id: number; name: string; role: Role; country: string | null; institution: string | null;
  field_of_study: string | null; level: Level | null; headline: string | null; bio?: string | null;
  website?: string | null; joined_at: string; connection?: ConnectionState; connections_count?: number;
  works?: Work[]; members?: Member[];
}
export interface ConnectionItem { id: number; user: Member; since: string; }
export interface ConnectionsResponse {
  accepted: ConnectionItem[]; incoming: ConnectionItem[]; outgoing: ConnectionItem[];
}
export interface University {
  id: number; name: string; country: string; city: string; website: string | null;
  description: string; is_demo: boolean; positions_count?: number;
}
export interface DocLabel { key: string; label: string; }
export interface Position {
  id: number; university_id: number; type: 'TA' | 'RA'; title: string; department: string; field: string;
  required_level: Level; min_average: number; language_requirements: Record<string, number>;
  language_waiver_allowed: boolean; required_documents: string[]; required_documents_labels: DocLabel[];
  funding: string; seats: number; deadline: string; description: string; university: University;
}
export interface Check { key: string; label: string; ok: boolean; expected: string; actual: string; }
export interface Eligibility { eligible: boolean; checks: Check[]; }
export interface CheckPayload {
  gpa: number | null; level: string | null; language_test: string | null;
  language_score: number | null; language_waiver: boolean; documents: string[];
}
export interface Application {
  id: number; status: 'submitted' | 'under_review' | 'accepted' | 'rejected'; created_at: string; position: Position;
}
export interface Stats { works: number; universities: number; positions: number; users: number; }
export type OpportunityType = 'employment' | 'internship' | 'scholarship' | 'ta' | 'ra' | 'mobility_program' | 'research_program' | 'other';
export type OpportunityStatus = 'draft' | 'open' | 'closed';
export type OpportunityApplicationStatus = 'submitted' | 'under_review' | 'shortlisted' | 'accepted' | 'rejected' | 'withdrawn';
export interface Opportunity {
  id: number; owner_id: number; owner: Pick<Member, 'id' | 'name' | 'role'> | null;
  type: OpportunityType; title: string; organization_name: string | null; location: string | null; country: string | null;
  remote: boolean; employment_type: string | null; funding: string | null; deadline: string | null;
  description: string; study_level: Level | null; requirements: string | null; skills: string[];
  required_documents: string[]; application_method: string | null;
  status: OpportunityStatus; is_favorited: boolean; created_at: string;
}
export interface OpportunityDocument { id: number; name: string; type: string; download_url: string; }
export interface OpportunityStatusChange { from_status: OpportunityApplicationStatus | null; to_status: OpportunityApplicationStatus; created_at: string; }
export interface OpportunityApplication {
  id: number; opportunity_id: number; user_id: number; motivation: string | null;
  documents: OpportunityDocument[]; status: OpportunityApplicationStatus; created_at: string;
  updated_at: string; opportunity?: Opportunity; applicant?: Member;
  history?: OpportunityStatusChange[];
}
export type FeedItem =
  | { type: 'work'; created_at: string; data: Work }
  | { type: 'opportunity'; created_at: string; data: Opportunity }
  | { type: 'highlight'; created_at: string; data: { id: number; title: string; message: string; institution: Member | null; student: Member | null } }
  | { type: 'institution_post'; created_at: string; data: InstitutionPost };
export interface InstitutionPost { id: number; title: string; body: string; institution: Member | null; created_at: string; }
export interface NotificationItem {
  id: string; type: string; data: Record<string, unknown>; read_at: string | null; created_at: string;
}
export interface AdminDashboard {
  accounts: { total: number; active: number; suspended: number; by_role: Record<string, number> };
  opportunities: { total: number; open: number; ta_ra_positions: number };
  academic_works: number;
  opportunity_applications: number; ta_ra_applications: number; open_reports: number;
}
export type ReportTargetType = 'member' | 'work' | 'opportunity';
export interface AdminReport {
  id: number; reporter: Pick<Member, 'id' | 'name' | 'role'> | null;
  target_type: ReportTargetType; target_id: number; target_label: string | null;
  reason: string; details: string | null; status: 'open' | 'reviewed' | 'dismissed';
  admin_note: string | null; created_at: string;
}
export interface AdminUser {
  id: number; name: string; email: string; role: Role; status: 'active' | 'suspended'; created_at: string;
}
export interface ApiError { message: string; errors?: Record<string, string[]>; status?: number; }
