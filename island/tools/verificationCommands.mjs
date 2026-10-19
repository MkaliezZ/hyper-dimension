// The release verifier runs the package's ordered Node test groups without a
// shell. Passing `&& node --test` to one Node process merges file discovery and
// loses both the isolation boundary and the stop-on-failure behavior.
export function verificationCommands(script) {
 if (typeof script !== 'string' || !script.trim()) throw Error('Missing default verification script');
 return script.split('&&').map(group => {
  const [executable, flag, ...files] = group.trim().split(/\s+/);
  if (executable !== 'node' || flag !== '--test' || !files.length ||
      files.some(file => !/^tests\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.m?js$/.test(file)))
   throw Error('Verification script must contain explicit Node test files joined by &&');
  return [flag, ...files];
 });
}

export async function runVerificationTests(script, execute) {
 // Validate the entire chain before starting any command.
 const commands = verificationCommands(script);
 for (const args of commands) await execute(args);
}
