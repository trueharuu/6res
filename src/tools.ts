import { execSync } from "node:child_process";

export function call(s: string): string {
    return execSync(s).toString('utf-8');
}