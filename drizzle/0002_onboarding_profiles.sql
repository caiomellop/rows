CREATE TABLE "profiles" (
	"userId" text PRIMARY KEY NOT NULL,
	"username" text,
	"githubLogin" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_format" CHECK ("profiles"."username" ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length("profiles"."username") BETWEEN 3 AND 39)
);
--> statement-breakpoint
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_username_unique" ON "profiles" USING btree ("username");
--> statement-breakpoint
-- Same lockdown as 0001: no access through Supabase's public REST API.
REVOKE ALL ON TABLE "profiles" FROM anon, authenticated;