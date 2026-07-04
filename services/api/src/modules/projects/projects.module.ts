import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { ProjectApiKeysController } from "./project-api-keys.controller";
import { ProjectApiKeysService } from "./project-api-keys.service";
import { MembershipGuard } from "./membership.guard";

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController, ProjectApiKeysController],
  providers: [ProjectsService, ProjectApiKeysService, MembershipGuard],
  exports: [ProjectsService, ProjectApiKeysService, MembershipGuard],
})
export class ProjectsModule {}
