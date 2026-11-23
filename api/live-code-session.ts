import {sessionStatus} from '../server/live-code-auth.js';
export default {fetch(request: Request) { return sessionStatus(request); }};
