import { Module } from "@nestjs/common";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { MembershipGuard } from "./membership.guard";

@Module({
  controllers: [ProjectsController],
  providers: [ProjectsService, MembershipGuard],
  exports: [ProjectsService, MembershipGuard],
})
export class ProjectsModule {}
