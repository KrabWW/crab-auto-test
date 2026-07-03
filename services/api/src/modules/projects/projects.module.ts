import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { MembershipGuard } from "./membership.guard";

@Module({
  imports: [AuditModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, MembershipGuard],
  exports: [ProjectsService, MembershipGuard],
})
export class ProjectsModule {}
