import { field, limit, PortalError, query, uuidPattern, write, type Profile } from './portal-store.js';

interface Question { prompt: string; options: string[]; correct: number }
interface Quiz { id: string; title: string; published: boolean; content: Question[]; audience?: string[] }

export async function quizAction(action: string, body: Record<string, unknown>, profile: Profile) {
  const teacher = profile.role === 'teacher';
  const own = { owner_id: `eq.${profile.id}` };
  const visible = { published: 'eq.true', audience: `cs.{"${profile.username}"}` };
  await limit(`quiz:${profile.id}`, 100);
  if (action === 'quiz:list') {
    const quizzes = await query<Quiz[]>('portal_quizzes', {
      ...(teacher ? own : visible), select: teacher ? 'id,title,published,content,audience' : 'id,title,published,content',
      order: 'created_at.desc', limit: '50',
    });
    const results = teacher ? [] : await query('portal_submissions', { student_id: `eq.${profile.id}`, select: 'quiz_id,score' });
    return { quizzes: teacher ? quizzes : quizzes.map((quiz) => ({
      ...quiz, content: quiz.content.map(({ prompt, options }) => ({ prompt, options })),
    })), results };
  }
  if (action === 'quiz:create' && teacher) {
    const title = field(body, 'title').trim();
    const questions = body.questions as Question[];
    const audience = [...new Set(field(body, 'audience').toLowerCase().split(/[\s,،]+/).filter(Boolean))];
    if (audience.length < 1 || audience.length > 100 || audience.some((name) => !/^[a-z0-9][a-z0-9_.-]{2,31}$/.test(name))) {
      throw new PortalError(422, 'نام کاربری ۱ تا ۱۰۰ دانشجو را وارد کنید.');
    }
    if (!title || title.length > 120 || !Array.isArray(questions) || questions.length < 1 || questions.length > 15 ||
      questions.some((q) => !q || typeof q.prompt !== 'string' || !q.prompt.trim() || q.prompt.length > 1000
        || !Array.isArray(q.options) || q.options.length !== 4
        || q.options.some((option) => typeof option !== 'string' || !option.trim() || option.length > 200)
        || new Set(q.options.map((option) => option.trim())).size !== 4
        || !Number.isInteger(q.correct) || q.correct < 0 || q.correct > 3)) {
      throw new PortalError(422, 'عنوان، مراحل و چهار گزینهٔ متفاوت برای هر مرحله را وارد کنید.');
    }
    await write('portal_quizzes', 'POST', { owner_id: profile.id, title, audience, content: questions.map(({ prompt, options, correct }) => ({ prompt, options, correct })) });
    return { ok: true };
  }

  const id = field(body, 'id');
  if (!uuidPattern.test(id)) throw new PortalError(422, 'آزمون معتبر نیست.');
  const [quiz] = await query<Quiz[]>('portal_quizzes', { id: `eq.${id}`, ...(teacher ? own : visible), select: 'id,title,published,content' });
  if (!quiz) throw new PortalError(404, 'آزمون در دسترس نیست.');
  if (action === 'quiz:publish' && teacher) {
    await write('portal_quizzes', 'PATCH', { published: true }, { id: `eq.${id}`, ...own });
    return { ok: true };
  }
  if (action === 'quiz:results' && teacher) {
    return { results: await query('portal_submissions', {
      quiz_id: `eq.${id}`, select: 'score,submitted_at,portal_profiles(first_name,last_name)', order: 'submitted_at.desc', limit: '100',
    }) };
  }
  if (action === 'quiz:submit' && !teacher) {
    const answers = body.answers as number[];
    if (!Array.isArray(answers) || answers.length !== quiz.content.length || answers.some((a) => !Number.isInteger(a) || a < 0 || a > 3)) {
      throw new PortalError(422, 'برای همهٔ مرحله‌ها گزینه انتخاب کنید.');
    }
    const score = quiz.content.reduce((total, question, index) => total + Number(question.correct === answers[index]), 0);
    await write('portal_submissions', 'POST', { quiz_id: id, student_id: profile.id, answers, score });
    return { score };
  }
  throw new PortalError(403, 'دسترسی به این عملیات مجاز نیست.');
}
