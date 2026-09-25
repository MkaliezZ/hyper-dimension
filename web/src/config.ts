import { DEMO_SITE } from "./data/demoSite";

export const SITE_TITLE = DEMO_SITE.title;
export const AUTHOR_NAME = DEMO_SITE.authorName;
export const AUTHOR_INITIAL = DEMO_SITE.authorShortName;
export const SITE_DESCRIPTION = DEMO_SITE.description;
export const GENERATE_SLUG_FROM_TITLE = false;
export const TRANSITION_API = true;
const BASE_PATH = import.meta.env.BASE_URL;
export const url = (path: string) => BASE_PATH.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
