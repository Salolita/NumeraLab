declare module '@ieaum/platform/economics-presentation' {
  const handler: { fetch(request: Request): Promise<Response> };
  export default handler;
}
