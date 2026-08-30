describe("index.html title", () => {
  test("document title should be TaApply", () => {
    document.title = "TaApply";
    expect(document.title).toBe("TaApply");
  });
});
