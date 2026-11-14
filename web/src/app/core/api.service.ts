import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  AdminDashboard, AdminReport, AdminUser, Application, ApiError, AuthResponse, CheckPayload, ConnectionsResponse,
  Eligibility, FeedItem, InstitutionHighlight, InstitutionPost, Member, NotificationItem, Opportunity,
  OpportunityApplication, OpportunityApplicationStatus, OpportunityType, Position, Profile, ProfileUpdate,
  PublicStudent, ReportTargetType, Stats, University, User, Work,
} from './models';

declare global { interface Window { __GRADHIVE__?: { apiUrl?: string }; } }

export const API_URL: string = (window.__GRADHIVE__?.apiUrl ?? 'http://localhost:8000/api').replace(/\/$/, '');

/** Convertit une erreur HTTP en message lisible et erreurs par champ. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) return { message: 'Impossible de joindre le serveur. Vérifiez votre connexion.' };
    const body = e.error as Partial<ApiError> | null;
    return { message: body?.message ?? 'Une erreur est survenue.', errors: body?.errors, status: e.status };
  }
  return { message: 'Une erreur est survenue.' };
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private url = (p: string) => `${API_URL}${p}`;
  private params(o: Record<string, string | number | null | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(o)) if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    return p;
  }

  // Authentification
  register(body: Record<string, unknown>) { return this.http.post<AuthResponse>(this.url('/register'), body); }
  login(body: { email: string; password: string }) { return this.http.post<AuthResponse>(this.url('/login'), body); }
  logout() { return this.http.post<{ message: string }>(this.url('/logout'), {}); }
  me() { return this.http.get<{ user: User }>(this.url('/me')); }
  stats() { return this.http.get<Stats>(this.url('/stats')); }

  // Profils étudiant et établissement
  myProfile() { return this.http.get<{ data: Profile }>(this.url('/my/profile')); }
  updateMyProfile(body: ProfileUpdate) {
    return this.http.patch<{ message: string; data: Profile }>(this.url('/my/profile'), body);
  }
  studentProfile(id: number) { return this.http.get<{ data: Profile }>(this.url(`/students/${id}/profile`)); }
  institutionProfile(id: number) { return this.http.get<{ data: Profile }>(this.url(`/institutions/${id}/profile`)); }
  institutionHighlights() { return this.http.get<{ data: InstitutionHighlight[] }>(this.url('/my/institution/highlights')); }
  eligibleStudents(q: string) {
    return this.http.get<{ data: PublicStudent[] }>(this.url('/my/institution/eligible-students'), { params: this.params({ q }) });
  }
  createHighlight(body: { student_id: number; title: string; message: string }) {
    return this.http.post<{ message: string; data: InstitutionHighlight }>(this.url('/my/institution/highlights'), body);
  }
  updateHighlight(id: number, body: { title: string; message: string }) {
    return this.http.put<{ message: string; data: InstitutionHighlight }>(this.url(`/my/institution/highlights/${id}`), body);
  }
  deleteHighlight(id: number) { return this.http.delete<{ message: string }>(this.url(`/my/institution/highlights/${id}`)); }
  reorderHighlights(ids: number[]) {
    return this.http.patch<{ message: string }>(this.url('/my/institution/highlights/order'), { ids });
  }
  myInstitutionPosts() { return this.http.get<{ data: InstitutionPost[] }>(this.url('/my/institution/posts')); }
  saveInstitutionPost(body: { title: string; body: string }, id?: number) {
    return id
      ? this.http.patch<{ data: InstitutionPost }>(this.url(`/my/institution/posts/${id}`), body)
      : this.http.post<{ data: InstitutionPost }>(this.url('/my/institution/posts'), body);
  }
  deleteInstitutionPost(id: number) {
    return this.http.delete<{ message: string }>(this.url(`/my/institution/posts/${id}`));
  }

  // Travaux académiques publiés pour être découverts par le réseau
  works(f: { q?: string; year?: string | number; level?: string; mention?: string; type?: string; visibility?: string; institution?: string; field_of_study?: string; author_id?: number }) {
    return this.http.get<{ data: Work[]; meta: { total: number } }>(this.url('/works'), { params: this.params(f) });
  }
  work(id: number) { return this.http.get<{ data: Work }>(this.url(`/works/${id}`)); }
  myWorks() { return this.http.get<{ data: Work[] }>(this.url('/my/works')); }
  createWork(fd: FormData) { return this.http.post<{ message: string; data: Work }>(this.url('/works'), fd); }
  updateWork(id: number, body: Record<string, string | number | null>) {
    return this.http.put<{ message: string; data: Work }>(this.url(`/works/${id}`), body);
  }
  deleteWork(id: number) { return this.http.delete<{ message: string }>(this.url(`/works/${id}`)); }
  downloadWork(id: number): Observable<Blob> { return this.http.get(this.url(`/works/${id}/download`), { responseType: 'blob' }); }

  // Universités et postes TA/RA
  universities() { return this.http.get<{ data: University[] }>(this.url('/universities')); }
  positions(f: { type?: string; q?: string; country?: string }) {
    return this.http.get<{ data: Position[] }>(this.url('/positions'), { params: this.params(f) });
  }
  position(id: number) { return this.http.get<{ data: Position }>(this.url(`/positions/${id}`)); }
  check(id: number, body: CheckPayload) { return this.http.post<Eligibility>(this.url(`/positions/${id}/check`), body); }
  apply(id: number, fd: FormData) { return this.http.post<{ message: string }>(this.url(`/positions/${id}/applications`), fd); }
  myApplications() { return this.http.get<{ data: Application[] }>(this.url('/my/applications')); }

  // Opportunités et candidatures
  opportunities(filters: { q?: string; type?: OpportunityType | ''; location?: string; country?: string; study_level?: string; remote?: string }) {
    return this.http.get<{ data: Opportunity[]; meta: { total: number } }>(this.url('/opportunities'), { params: this.params(filters) });
  }
  opportunity(id: number) { return this.http.get<{ data: Opportunity }>(this.url(`/opportunities/${id}`)); }
  myOpportunities() { return this.http.get<{ data: Opportunity[] }>(this.url('/my/opportunities')); }
  saveOpportunity(body: Partial<Opportunity> & Pick<Opportunity, 'type' | 'title' | 'description'>, id?: number) {
    return id
      ? this.http.patch<{ data: Opportunity }>(this.url(`/opportunities/${id}`), body)
      : this.http.post<{ data: Opportunity }>(this.url('/opportunities'), body);
  }
  deleteOpportunity(id: number) { return this.http.delete<{ message: string }>(this.url(`/opportunities/${id}`)); }
  favoriteOpportunity(id: number, favorite: boolean) {
    return favorite
      ? this.http.post<{ message: string }>(this.url(`/opportunities/${id}/favorite`), {})
      : this.http.delete<{ message: string }>(this.url(`/opportunities/${id}/favorite`));
  }
  favoriteOpportunities() { return this.http.get<{ data: Opportunity[] }>(this.url('/my/favorite-opportunities')); }
  applyToOpportunity(id: number, body: FormData) {
    return this.http.post<{ data: OpportunityApplication }>(this.url(`/opportunities/${id}/applications`), body);
  }
  myOpportunityApplications() { return this.http.get<{ data: OpportunityApplication[] }>(this.url('/my/opportunity-applications')); }
  withdrawOpportunityApplication(id: number) {
    return this.http.patch<{ data: OpportunityApplication }>(this.url(`/my/opportunity-applications/${id}/withdraw`), {});
  }
  receivedOpportunityApplications(id: number) {
    return this.http.get<{ data: OpportunityApplication[] }>(this.url(`/my/opportunities/${id}/applications`));
  }
  reviewOpportunityApplication(opportunityId: number, applicationId: number, status: OpportunityApplicationStatus) {
    return this.http.patch<{ data: OpportunityApplication }>(
      this.url(`/opportunities/${opportunityId}/applications/${applicationId}/status`), { status },
    );
  }
  opportunityDocument(applicationId: number, documentId: number): Observable<Blob> {
    return this.http.get(this.url(`/opportunity-applications/${applicationId}/documents/${documentId}`), { responseType: 'blob' });
  }

  // Annuaire et relations
  members(filters: { role?: string; q?: string; country?: string; level?: string }) {
    return this.http.get<{ data: Member[]; meta: { total: number } }>(this.url('/members'), { params: this.params(filters) });
  }
  searchPublicMembers(q: string) {
    return this.http.get<{ data: Member[]; meta: { total: number } }>(this.url('/search/members'), { params: this.params({ q }) });
  }
  member(id: number) { return this.http.get<{ data: Member }>(this.url(`/members/${id}`)); }
  connections() { return this.http.get<ConnectionsResponse>(this.url('/connections')); }
  createConnection(userId: number) { return this.http.post<{ message: string; connection: string }>(this.url('/connections'), { user_id: userId }); }
  acceptConnection(id: number) { return this.http.patch<{ message: string }>(this.url(`/connections/${id}/accept`), {}); }
  declineConnection(id: number) { return this.http.patch<{ message: string }>(this.url(`/connections/${id}/decline`), {}); }
  removeConnection(id: number) { return this.http.delete<{ message: string }>(this.url(`/connections/${id}`)); }
  feed() { return this.http.get<{ data: FeedItem[]; meta: { total: number } }>(this.url('/feed')); }
  notifications() {
    return this.http.get<{ data: NotificationItem[]; meta: { unread_count: number } }>(this.url('/notifications'));
  }
  markNotificationRead(id: string) { return this.http.patch<{ data: { id: string; read_at: string } }>(this.url(`/notifications/${id}/read`), {}); }
  markAllNotificationsRead() { return this.http.patch<{ message: string }>(this.url('/notifications/read-all'), {}); }
  createReport(targetType: ReportTargetType, targetId: number, reason: string, details: string) {
    return this.http.post<{ data: { id: number; status: string } }>(this.url('/reports'), {
      target_type: targetType, target_id: targetId, reason, details,
    });
  }

  // Administration
  adminDashboard() { return this.http.get<{ data: AdminDashboard }>(this.url('/admin/dashboard')); }
  adminUsers(filters: { q?: string; role?: string; status?: string }) {
    return this.http.get<{ data: AdminUser[]; meta: { total: number } }>(this.url('/admin/users'), { params: this.params(filters) });
  }
  setUserStatus(id: number, status: 'active' | 'suspended') {
    return this.http.patch<{ data: { id: number; status: string } }>(
      this.url(`/admin/users/${id}/${status === 'active' ? 'reactivate' : 'suspend'}`), {},
    );
  }
  adminReports(filters: { status?: string; target_type?: string }) {
    return this.http.get<{ data: AdminReport[]; meta: { total: number } }>(this.url('/admin/reports'), { params: this.params(filters) });
  }
  reviewReport(id: number, status: 'reviewed' | 'dismissed', admin_note: string) {
    return this.http.patch<{ data: { id: number; status: string } }>(this.url(`/admin/reports/${id}`), { status, admin_note });
  }
}
