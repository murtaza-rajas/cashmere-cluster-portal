import { Module } from '@nestjs/common';
import { ShowcaseController } from './showcase.controller';
import { StoriesModule } from '../stories/stories.module';
import { HomepageUpdatesModule } from '../homepage-updates/homepage-updates.module';

@Module({
  imports: [StoriesModule, HomepageUpdatesModule],
  controllers: [ShowcaseController],
})
export class ShowcaseModule {}
