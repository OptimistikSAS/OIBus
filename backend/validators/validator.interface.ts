export default interface ValidatorInterface {
  validate(dto: any): Promise<void>;
}
