interface ScheduledController {
  readonly cron: string;
  noRetry(): void;
}
