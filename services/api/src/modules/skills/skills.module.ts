import { Module } from "@nestjs/common";
import { AuditModule } from "../audit/audit.module";
import { SkillsController } from "./skills.controller";
import { SkillsService } from "./skills.service";
import { SkillAdapterService } from "./skill-adapter.service";

@Module({
  imports: [AuditModule],
  controllers: [SkillsController],
  providers: [SkillsService, SkillAdapterService],
  exports: [SkillsService, SkillAdapterService],
})
export class SkillsModule {}
