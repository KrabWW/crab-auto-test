import { Module } from "@nestjs/common";
import { TestAssetsController } from "./test-assets.controller";
import { TestAssetsService } from "./test-assets.service";

@Module({
  controllers: [TestAssetsController],
  providers: [TestAssetsService],
  exports: [TestAssetsService],
})
export class TestAssetsModule {}
