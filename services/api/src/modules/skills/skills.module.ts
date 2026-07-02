import { Module } from "@nestjs/common";
import { SkillsController } from "./skills.controller";
import { SkillsService } from "./skills.service";
import { SkillAdapterService } from "./skill-adapter.service";

@Module({
  controllers: [SkillsController],
  providers: [SkillsService, SkillAdapterService],
  exports: [SkillsService, SkillAdapterService],
})
export class SkillsModule {}
