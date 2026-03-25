# AGENTS.md

## General Rules

- You must always commit your changes whenever you update code.
- Make sure any sensitive information (eg. API keys, passwords) are not persisted anywhere without hashing. Also never pass API keys or any sort of sensitive keys as HTTP query params.
- Always ensure the backend API uses security good practices to avoid known HTTP/web security flaws.

## Branch Development Workflow

- You prefer to use branch development.
- Before writing any code, check if you are in a feature branch (eg. `feature/branch_name`). If not already in an existing feature branch, create one to hold the changes.
- After you are done - provide instructions in a `MERGE.md` file that explains how to merge the changes back to main with both a GitHub PR route and a GitHub CLI route.

## Frontend Rules

- You must pay attention to visual clarity and contrast. Do not place white text on a white background.
- You must ensure the UX is pleasant. Boxes should grow to fit their contents, etc.
- When asking the user for sensitive information - you must use password style text-entry boxes in the UI.
- This frontend will ultimately be deployed on Vercel, but it should be possible to test locally.
- Always provide users with a way to run the created UI once you have created it.

## Local dev
 - Before starting the frontend or the backend service in dev mode, make a copy of the `~/tmp/tuelhosai.env` file into the root of this repo as `.env`. This way the services can be tested locally.
 - NEVER Commit the `.env` into git. I must be GIT IGNORED!

## README Rules

- When you create README.md's - they should be dope, and use fun and approachable language.
- While being fun, they should remain technically accurate.