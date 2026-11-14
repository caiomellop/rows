CREATE TABLE "assistant_threads" (
	"userId" text PRIMARY KEY NOT NULL,
	"messages" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assistant_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experience_projects" (
	"experienceId" text NOT NULL,
	"projectId" text NOT NULL,
	CONSTRAINT "experience_projects_experienceId_projectId_pk" PRIMARY KEY("experienceId","projectId")
);
--> statement-breakpoint
ALTER TABLE "experience_projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"kind" text DEFAULT 'work' NOT NULL,
	"title" text NOT NULL,
	"organization" text NOT NULL,
	"location" text,
	"startDate" text,
	"endDate" text,
	"current" boolean DEFAULT false NOT NULL,
	"bullets" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "experiences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "profiles" (
	"userId" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"githubLogin" text,
	"displayName" text,
	"headline" text,
	"summary" text,
	"summarySource" text,
	"location" text,
	"timezone" text,
	"openToWork" boolean DEFAULT false NOT NULL,
	"roleTypes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"workMode" text,
	"workAuthorization" text,
	"contactEmail" text,
	"links" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"goals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"reposSyncedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"source" text NOT NULL,
	"externalId" text NOT NULL,
	"name" text NOT NULL,
	"fullName" text NOT NULL,
	"url" text NOT NULL,
	"homepage" text,
	"description" text,
	"languages" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"primaryLanguage" text,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"forks" integer DEFAULT 0 NOT NULL,
	"isFork" boolean DEFAULT false NOT NULL,
	"isArchived" boolean DEFAULT false NOT NULL,
	"pushedAt" timestamp,
	"createdAtSource" timestamp,
	"userCommits" integer,
	"totalCommits" integer,
	"firstCommitAt" timestamp,
	"lastCommitAt" timestamp,
	"role" text,
	"hasTests" boolean,
	"hasCi" boolean,
	"dependencies" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readme" text,
	"detailsSyncedAt" timestamp,
	"pinned" boolean DEFAULT false NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"card" jsonb,
	"cardStatus" text DEFAULT 'none' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assistant_threads" ADD CONSTRAINT "assistant_threads_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_projects" ADD CONSTRAINT "experience_projects_experienceId_experiences_id_fk" FOREIGN KEY ("experienceId") REFERENCES "public"."experiences"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experience_projects" ADD CONSTRAINT "experience_projects_projectId_projects_id_fk" FOREIGN KEY ("projectId") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "experiences_user" ON "experiences" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_user_source_external" ON "projects" USING btree ("userId","source","externalId");--> statement-breakpoint
CREATE INDEX "projects_user_pinned" ON "projects" USING btree ("userId","pinned");--> statement-breakpoint
-- Same lockdown as 0001: no access through Supabase's public REST API.
REVOKE ALL ON TABLE "assistant_threads", "experience_projects", "experiences", "profiles", "projects" FROM anon, authenticated;
