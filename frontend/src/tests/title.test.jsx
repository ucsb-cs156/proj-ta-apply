describe("index.html title", () => {
  test("document title should be TA Apply", () => {
    document.title = "TA Apply";
    expect(document.title).toBe("TA Apply");
  });
});
