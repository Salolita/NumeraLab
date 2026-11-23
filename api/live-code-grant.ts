import {grant} from '../server/live-code-auth.js';
export default {fetch(request: Request) { return grant(request); }};
