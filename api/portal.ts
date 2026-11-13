import {
  cookieValue, currentProfile, digest, field, internalEmail, limit, PortalError,
  query, readBody, reply, rpc, setting, studentNumber, supabase, token, tokenPattern, write,
} from '../server/portal-store.js';
import { eligibleStudent, telegramWebhook } from '../server/portal-bot.js';
import { quizAction } from '../server/portal-quizzes.js';

interface Ticket {
  invite_hash: string | null;
  profile_id: string | null;
}

async function activeTicket(raw: string) {
  if (!tokenPattern.test(raw)) throw new PortalError(400, 'لینک معتبر نیست. از ربات لینک تازه بگیرید.');
  const [ticket] = await query<Ticket[]>('portal_tickets', {
    token_hash: `eq.${digest(raw)}`, expires_at: `gt.${new Date().toISOString()}`, select: 'invite_hash,profile_id', limit: '1',
  });
  if (!ticket) throw new PortalError(400, 'لینک منقضی شده یا قبلاً استفاده شده است. از ربات لینک تازه بگیرید.');
  return ticket;
}

export default {
  async fetch(request: Request) {
    try {
      if (request.method === 'GET') {
        const enabled = process.env.PORTAL_ENABLED === 'true';
        return reply({ profile: enabled ? await currentProfile(request) : null, enabled });
      }
      if (request.method !== 'POST') return reply({ error: 'درخواست معتبر نیست.' }, 405);
      const url = new URL(request.url);
      if (setting('PORTAL_ENABLED') !== 'true') throw new PortalError(503, 'سامانهٔ حساب‌ها هنوز راه‌اندازی نشده است.');
      if (url.searchParams.get('telegram') === '1') return await telegramWebhook(request);
      if (request.headers.get('origin') !== setting('PORTAL_ORIGIN')) throw new PortalError(403, 'درخواست معتبر نیست.');
      const body = await readBody(request);
      const action = field(body, 'action');
      if (action === 'logout') {
        const session = cookieValue(request);
        if (session) await write('portal_sessions', 'DELETE', undefined, { token_hash: `eq.${digest(session)}` });
        return reply({ ok: true }, 200, null);
      }
      if (action.startsWith('quiz:')) {
        const profile = await currentProfile(request);
        if (!profile) throw new PortalError(401, 'ابتدا وارد پنل شوید.');
        return reply(await quizAction(action, body, profile));
      }
      if (action !== 'register' && action !== 'login') throw new PortalError(400, 'درخواست معتبر نیست.');

      const username = field(body, 'username').trim().toLowerCase();
      const password = field(body, 'password');
      if (!/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(username) || password.length < 12 || new TextEncoder().encode(password).length > 72) {
        throw new PortalError(422, 'نام کاربری باید ۳ تا ۳۲ نویسهٔ انگلیسی و رمز عبور ۱۲ نویسه تا ۷۲ بایت باشد.');
      }

      if (action === 'register') {
        const rawTicket = field(body, 'ticket');
        const ticket = await activeTicket(rawTicket);
        if (!ticket.invite_hash) throw new PortalError(400, 'لینک ثبت‌نام معتبر نیست.');
        await limit(`ticket:${ticket.invite_hash}`, 8);
        const [invite] = await query<{ role: string }[]>('portal_invites', {
          code_hash: `eq.${ticket.invite_hash}`, select: 'role', used_at: 'is.null', expires_at: `gt.${new Date().toISOString()}`,
        });
        if (!invite) throw new PortalError(400, 'دعوت معتبر نیست.');
        const first = field(body, 'firstName').trim();
        const last = field(body, 'lastName').trim();
        const number = studentNumber(field(body, 'studentNumber'));
        const date = field(body, 'birthDate');
        const parsedDate = new Date(date + 'T00:00:00Z');
        const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(parsedDate.getTime())
          && parsedDate.toISOString().slice(0, 10) === date && date >= '1900-01-01' && date < new Date().toISOString().slice(0, 10);
        if (!first || !last || first.length > 80 || last.length > 80 ||
          (invite.role === 'student' && (!eligibleStudent(number) || !validDate))) {
          throw new PortalError(422, 'مشخصات ثبت‌نام معتبر نیست. اطلاعات و شرایط دعوت را بررسی کنید.');
        }
        await supabase('/auth/v1/admin/users', 'POST', {
          email: internalEmail(username), password, email_confirm: true,
          app_metadata: { portal_signup: {
            ticket: digest(rawTicket), username, first_name: first, last_name: last,
            student_number: invite.role === 'student' ? number : null, birth_date: invite.role === 'student' ? date : null,
          } },
        });
        return reply({ registered: true });
      }

      const ip = request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
      await limit(`login:ip:${ip}`, 35);
      await limit(`login:username:${username}`, 10);
      const invalid = 'نام کاربری یا رمز عبور معتبر نیست.';
      const auth = await supabase<{ user: { id: string }; access_token: string }>('/auth/v1/token?grant_type=password', 'POST', {
        email: internalEmail(username), password,
      }, true);
      // Supabase Auth verifies the password. The portal issues its own revocable session.
      // End the upstream session so its refresh token does not remain usable.
      await supabase('/auth/v1/logout?scope=local', 'POST', undefined, true, auth.access_token);
      const [expected] = await query<{ id: string }[]>('portal_profiles', {
        id: `eq.${auth.user.id}`, username: `eq.${username}`, active: 'eq.true', select: 'id', limit: '1',
      });
      if (!expected) throw new PortalError(401, invalid);
      const session = token();
      await write('portal_sessions', 'POST', { token_hash: digest(session), profile_id: expected.id });
      const previous = cookieValue(request);
      if (previous) await write('portal_sessions', 'DELETE', undefined, { token_hash: `eq.${digest(previous)}` });
      return reply({ loggedIn: true }, 200, session);
    } catch (error) {
      if (error instanceof PortalError) return reply({ error: error.message }, error.status);
      return reply({ error: 'درخواست انجام نشد. دوباره تلاش کنید.' }, 503);
    }
  },
};
